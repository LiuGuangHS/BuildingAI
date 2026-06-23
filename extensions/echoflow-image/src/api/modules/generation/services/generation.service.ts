import { BaseService } from "@buildingai/base";
import { ACTION } from "@buildingai/constants/shared/account-log.constants";
import { FileStorageService, FileUploadService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { EntityManager, FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThan, Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    PublicAiModelService,
    assertPublicHttpUrl,
    buildDefinedWhere,
    normalizePublicHttpUrl,
    safeJsonParse,
} from "@buildingai/extension-sdk";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import path from "node:path";
import type { Readable } from "node:stream";

import {
    ImageGeneration,
    ImageGenerationBillingStatus,
    ImageGenerationMode,
    ImageGenerationStatus,
    type ImageSourceRecord,
    ImageResponseFormat,
} from "../../../db/entities/image-generation.entity";
import { ImageBillingRule } from "../../../db/entities/image-billing-rule.entity";
import {
    ImageModelConfig,
    type ImageModelAllowedParams,
    type ImageModelCapabilities,
    type ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../../db/entities/image-policy-config.entity";
import { ImagePromptTemplate } from "../../../db/entities/image-prompt-template.entity";
import { BillingRuleService, normalizePowerAmount } from "../../billing/services/billing-rule.service";
import { ModelConfigService, type ResolvedImageModelConfig } from "../../config/services/model-config.service";
import { PolicyService } from "../../policy/services/policy.service";
import { CreateGenerationDto, PromptEnhanceDto, QueryGenerationDto } from "../dto";
import { IMAGE_GENERATION_JOB, IMAGE_GENERATION_QUEUE } from "./generation-queue.constants";
import {
    IMAGE_PENDING_RESUME_AFTER_MS,
    IMAGE_PROCESSING_TIMEOUT_MS,
    getResumedImageProgress,
} from "./image-generation-recovery-rules";
import { OpenAIImageClient } from "./openai-image-client";

const EXTENSION_ID = "echoflow-image";

@Injectable()
export class GenerationService extends BaseService<ImageGeneration> implements OnModuleInit {
    protected readonly logger = new Logger(GenerationService.name);

    constructor(
        @InjectRepository(ImageGeneration)
        private readonly generationRepository: Repository<ImageGeneration>,
        private readonly aiModelService: PublicAiModelService,
        private readonly billingService: ExtensionBillingService,
        private readonly modelConfigService: ModelConfigService,
        private readonly billingRuleService: BillingRuleService,
        private readonly policyService: PolicyService,
        private readonly fileUploadService: FileUploadService,
        private readonly fileStorageService: FileStorageService,
        private readonly notificationService: ExtensionNotificationService,
        @InjectQueue(IMAGE_GENERATION_QUEUE)
        private readonly generationQueue: Queue,
    ) {
        super(generationRepository);
    }

    async onModuleInit() {
        try {
            await this.registerNotificationScenes();
            await this.recoverJobs();
        } catch (error) {
            this.logger.error("Recover generation jobs failed", error);
        }
    }

    private async registerNotificationScenes() {
        await this.notificationService.registerScenes(EXTENSION_ID, [
            {
                sceneCode: `${EXTENSION_ID}.generation.succeeded`,
                name: "图片生成完成",
                description: "用户发起的图片生成任务处理成功。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "图片生成完成",
                contentTemplate: "{{taskName}} 已生成，可前往查看结果。",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
            {
                sceneCode: `${EXTENSION_ID}.generation.failed`,
                name: "图片生成失败",
                description: "用户发起的图片生成任务处理失败。",
                level: "error",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "图片生成失败",
                contentTemplate: "{{taskName}} 处理失败，{{reason}}",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
        ]);
    }

    /**
     * Create a generation record and execute image generation.
     *
     * Flow:
     * 1. Validate input & model
     * 2. Idempotency check via requestKey (try-insert for TOCTOU safety)
     * 3. Pre-check balance
     * 4. Deduct power FIRST
     * 5. Generate image
     * 6. On success: mark SUCCEEDED + billing DEDUCTED
     * 7. On generation failure: refund power, mark FAILED + billing REFUNDED
     */
    async createAndGenerate(dto: CreateGenerationDto, userId: string) {
        // Fast idempotency path: repeated requests should return the original
        // record without requiring current balance/model/provider state.
        if (dto.requestKey) {
            const existing = await this.generationRepository.findOne({
                where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<ImageGeneration>,
            });
            if (existing) {
                this.logger.warn(`Duplicate requestKey ${dto.requestKey} for user ${userId}, returning existing ${existing.id}`);
                return existing;
            }
        }

        const effectiveConfig = await this.modelConfigService.findEnabledByModel(dto.modelId);
        const runtime = await this.modelConfigService.resolveRuntimeEndpoint(effectiveConfig);
        const normalizedRequest = await this.normalizeGenerationRequest(dto, effectiveConfig);
        const normalizedDto = {
            ...dto,
            referenceImageUrl: normalizedRequest.referenceImageUrl,
            referenceImageFileId: normalizedRequest.primarySourceImage?.fileId,
            sourceImages: normalizedRequest.sourceImages,
            maskImageUrl: normalizedRequest.maskImageUrl,
            mode: normalizedRequest.mode,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
            style: normalizedRequest.style,
            responseFormat: normalizedRequest.responseFormat,
            outputFormat: normalizedRequest.outputFormat,
        };
        this.validateAllowedParams(normalizedDto, effectiveConfig, normalizedRequest.sourceImages);
        const usage = await this.getUserPolicyUsage(userId);
        const modelConfigId = effectiveConfig.id;
        const policy = await this.policyService.validateGeneration(modelConfigId, normalizedDto, usage.activeCount, usage.todayCount);
        void policy;

        const billingAmount = await this.billingRuleService.calculateAmount({
            modelConfigId,
            mode: normalizedRequest.mode,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
        });

        // --- Pre-check balance ---
        const hasPower = await this.billingService.hasSufficientPower(userId, billingAmount);
        if (!hasPower) {
            throw HttpErrorFactory.badRequest("可用算力不足，请充值后重试");
        }

        // --- Stage 0: Idempotency via try-insert ---
        // Use a unique insert to avoid TOCTOU race between find and save.
        // If a record with the same requestKey already exists, the save will fail
        // with a unique constraint violation. We catch that and return the existing record.
        // --- Stage 1: Create record with PENDING billing ---
        const baseURLSummary = this.sanitizeBaseURL(runtime.baseUrl);

        const record = this.generationRepository.create({
            userId,
            requestKey: dto.requestKey,
            modelConfigId,
            mode: normalizedRequest.mode,
            status: ImageGenerationStatus.PENDING,
            billingStatus: ImageGenerationBillingStatus.PENDING,
            prompt: this.sanitizeText(dto.prompt, 4000),
            negativePrompt: dto.negativePrompt ? this.sanitizeText(dto.negativePrompt, 2000) : undefined,
            referenceImageUrl: normalizedRequest.referenceImageUrl,
            referenceImageFileId: normalizedRequest.primarySourceImage?.fileId,
            modelId: effectiveConfig.model,
            modelName: effectiveConfig.displayName,
            provider: effectiveConfig.provider,
            baseURL: baseURLSummary,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
            style: normalizedRequest.style,
            responseFormat: normalizedRequest.responseFormat,
            apiMode: effectiveConfig.requestContract,
            requestPolicy: effectiveConfig.requestContract,
            sourceImages: normalizedRequest.sourceImages,
            maskImage: normalizedRequest.hasMaskImage
                ? { url: normalizedRequest.maskImageUrl, fileId: dto.maskImageFileId }
                : undefined,
            outputFormat: normalizedRequest.outputFormat,
            background: dto.background,
            outputCompression: dto.outputCompression,
            inputFidelity: dto.inputFidelity,
            moderation: dto.moderation,
            seed: dto.seed,
            resultImages: [],
            storageFiles: [],
            rawEvents: [],
            progress: 0,
            billingAmount,
        });

        let saved: ImageGeneration;
        try {
            saved = await this.generationRepository.save(record);
        } catch (error) {
            if (dto.requestKey && this.isUniqueConstraintError(error)) {
                const existing = await this.generationRepository.findOne({
                    where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<ImageGeneration>,
                });
                if (existing) {
                    this.logger.warn(`Duplicate requestKey ${dto.requestKey} for user ${userId}, returning existing ${existing.id}`);
                    return existing;
                }
            }
            throw error;
        }

        await this.enqueueGenerationJob(saved.id);
        return saved;
    }

    async createAndGenerateForWeb(dto: CreateGenerationDto, userId: string) {
        return this.toPublicGeneration(await this.createAndGenerate(dto, userId));
    }

    async recoverJobs() {
        const now = Date.now();
        const staleProcessingDate = new Date(now - IMAGE_PROCESSING_TIMEOUT_MS);
        const resumableDate = new Date(now - IMAGE_PENDING_RESUME_AFTER_MS);

        const staleProcessing = await this.generationRepository.find({
            where: {
                status: ImageGenerationStatus.PROCESSING,
                updatedAt: LessThan(staleProcessingDate),
            } as FindOptionsWhere<ImageGeneration>,
            take: 20,
        });
        for (const item of staleProcessing) {
            await this.markGenerationCrashed(item.id, new Error("生成任务超时，已自动终止"));
        }

        const resumable = await this.generationRepository.find({
            where: {
                status: ImageGenerationStatus.PENDING,
                updatedAt: LessThan(resumableDate),
            } as FindOptionsWhere<ImageGeneration>,
            order: { createdAt: "ASC" },
            take: 10,
        });

        let resumed = 0;
        for (const item of resumable) {
            item.status = ImageGenerationStatus.PENDING;
            item.progress = getResumedImageProgress(item.progress);
            await this.generationRepository.save(item);
            await this.enqueueGenerationJob(item.id);
            resumed += 1;
        }

        return {
            resumed,
            timedOut: staleProcessing.length,
        };
    }

    async executeGenerationJob(id: string) {
        let saved = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<ImageGeneration>,
        });

        if (!saved) {
            throw HttpErrorFactory.notFound("生成记录不存在");
        }

        if (saved.status !== ImageGenerationStatus.PENDING) {
            return saved;
        }

        const startedAt = saved.startedAt ?? new Date();
        const claimed = await this.generationRepository.update(
            { id, status: ImageGenerationStatus.PENDING } as FindOptionsWhere<ImageGeneration>,
            {
                status: ImageGenerationStatus.PROCESSING,
                startedAt,
                progress: Math.max(saved.progress ?? 0, 5),
            },
        );

        if (!claimed.affected) {
            return this.findById(id);
        }

        const modelConfig = await this.modelConfigService.findEnabledByModel(saved.modelId);
        const runtime = await this.modelConfigService.resolveRuntimeEndpoint(modelConfig);
        const modelConfigId = modelConfig.id ?? saved.modelConfigId;
        const policy = await this.policyService.resolvePolicy(modelConfigId);
        const billingRule = await this.billingRuleService.resolveRule(modelConfigId);

        saved.status = ImageGenerationStatus.PROCESSING;
        saved.startedAt = startedAt;
        saved.progress = Math.max(saved.progress ?? 0, 5);

        // --- Stage 2: Deduct power ---
        try {
            saved = await this.deductGenerationBilling(
                saved,
                `Echoflow Image: ${modelConfig.displayName || modelConfig.model}`,
            );
        } catch (deductError) {
            saved.status = ImageGenerationStatus.FAILED;
            saved.billingStatus = ImageGenerationBillingStatus.FAILED;
            saved.errorMessage = "算力扣费失败，请稍后重试";
            saved.completedAt = new Date();
            await this.generationRepository.save(saved);
            this.logger.error(`Deduction failed for generation ${saved.id}`, deductError);
            return saved;
        }

        // --- Stage 3: Generate ---
        try {
            saved.progress = 30;
            await this.generationRepository.save(saved);
            const result = await this.generateWithProvider(saved, modelConfig, runtime, policy.maxReferenceImageSizeMb);
            const storedResult = await this.storeResultImages(saved.id, result.images);
            saved.resultImages = storedResult.images;
            saved.storageFiles = storedResult.storageFiles;
            saved.rawRequest = this.compactRawPayload(result.rawRequest);
            saved.rawResponse = this.compactRawPayload(result.rawResponse);
            saved.status = ImageGenerationStatus.SUCCEEDED;
            saved.progress = 100;
            saved.completedAt = new Date();
            await this.generationRepository.save(saved);
            this.logger.log(`Generation ${saved.id} succeeded: ${result.images.length} images`);
            await this.notifyTerminalStatus(saved);
            return saved;
        } catch (generateError) {
            const rawMessage =
                generateError instanceof Error ? generateError.message : "Image generation failed";
            saved.status = ImageGenerationStatus.FAILED;
            saved.errorMessage = this.truncateText(rawMessage, 2000);
            saved.failureCategory = this.classifyFailure(generateError);
            saved.completedAt = new Date();

            if (billingRule.refundOnFailure !== false) {
                try {
                    await this.refundGenerationBilling(saved, `Refund for failed generation ${saved.id}`);
                } catch (refundError) {
                    saved.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
                    await this.recordRefundFailureMetadata(saved, refundError);
                    saved.errorMessage = this.truncateText(
                        `${saved.errorMessage} (退款失败，请联系管理员)`,
                        2000,
                    );
                    this.logger.error(`Refund failed for generation ${saved.id}`, refundError);
                }
            }

            await this.generationRepository.save(saved);
            this.logger.warn(`Generation ${saved.id} failed: ${saved.errorMessage}`);
            await this.notifyTerminalStatus(saved);
            return saved;
        }
    }

    private async enqueueGenerationJob(id: string) {
        try {
            await this.generationQueue.add(
                IMAGE_GENERATION_JOB,
                { id },
                {
                    jobId: `image-generation-${id}-${Date.now()}`,
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Queue image generation ${id} failed: ${message}`, error);
            await this.markGenerationCrashed(id, new Error("图片生成队列暂不可用，请稍后重试"));
            throw HttpErrorFactory.badRequest("图片生成队列暂不可用，请稍后重试");
        }
    }

    private normalizeCapabilities(capabilities?: ImageModelCapabilities): ImageModelCapabilities {
        return {
            textToImage: true,
            imageToImage: false,
            mask: false,
            multiReference: false,
            seed: false,
            negativePrompt: true,
            outputFormat: false,
            background: false,
            moderation: false,
            inputFidelity: false,
            ...(capabilities ?? {}),
        };
    }

    private normalizeDefaultParams(
        defaultParams?: ImageModelDefaultParams,
        capabilities?: ImageModelCapabilities,
    ): ImageModelDefaultParams {
        const normalizedCapabilities = this.normalizeCapabilities(capabilities);
        const normalized: ImageModelDefaultParams = {
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
            n: 1,
            responseFormat: ImageResponseFormat.B64_JSON,
            ...(defaultParams ?? {}),
        };
        if (!normalizedCapabilities.outputFormat) {
            delete normalized.outputFormat;
        }
        return normalized;
    }

    private normalizeAllowedParams(
        allowedParams?: ImageModelAllowedParams,
        capabilities?: ImageModelCapabilities,
    ): ImageModelAllowedParams {
        const normalizedCapabilities = this.normalizeCapabilities(capabilities);
        const normalized: ImageModelAllowedParams = {
            sizes: ["1024x1024", "1024x1792", "1792x1024"],
            qualities: ["standard", "hd"],
            styles: ["vivid", "natural"],
            maxImages: 4,
            ...(allowedParams ?? {}),
        };
        if (!normalizedCapabilities.outputFormat) {
            delete normalized.outputFormats;
        }
        return normalized;
    }

    async markGenerationCrashed(id: string, error: unknown) {
        const saved = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<ImageGeneration>,
        });
        if (!saved || [ImageGenerationStatus.SUCCEEDED, ImageGenerationStatus.FAILED].includes(saved.status)) {
            return;
        }

        const rawMessage = error instanceof Error ? error.message : "Image generation failed";
        saved.status = ImageGenerationStatus.FAILED;
        saved.errorMessage = this.truncateText(rawMessage, 2000);
        saved.failureCategory = this.classifyFailure(error);
        saved.completedAt = new Date();

        const billingRule = await this.billingRuleService.resolveRule(saved.modelConfigId);
        if (billingRule.refundOnFailure !== false) {
            try {
                await this.refundGenerationBilling(saved, `Refund for crashed generation ${saved.id}`);
            } catch (refundError) {
                saved.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
                await this.recordRefundFailureMetadata(saved, refundError);
                saved.errorMessage = this.truncateText(
                    `${saved.errorMessage} (退款失败，请联系管理员)`,
                    2000,
                );
                this.logger.error(`Crash refund failed for generation ${saved.id}`, refundError);
            }
        }
        if (saved.billingStatus === ImageGenerationBillingStatus.PENDING) {
            saved.billingStatus = ImageGenerationBillingStatus.FAILED;
        }

        await this.generationRepository.save(saved);
        await this.notifyTerminalStatus(saved);
    }

    private async recordRefundFailureMetadata(record: ImageGeneration, error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const update = {
            rawResponse: {
                ...(record.rawResponse ?? {}),
                metadata: {
                    ...(typeof record.rawResponse?.metadata === "object" && record.rawResponse.metadata !== null
                        ? record.rawResponse.metadata
                        : {}),
                    refundError: this.truncateText(message, 1000),
                    refundFailedAt: new Date().toISOString(),
                },
            },
        };
        record.rawResponse = update.rawResponse;
        try {
            await this.generationRepository.update(record.id, update);
        } catch (metadataError) {
            this.logger.warn(
                `Persist image generation ${record.id} refund failure metadata failed: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`,
            );
        }
    }

    private async notifyTerminalStatus(record: ImageGeneration) {
        if (![ImageGenerationStatus.SUCCEEDED, ImageGenerationStatus.FAILED].includes(record.status)) {
            return;
        }
        const succeeded = record.status === ImageGenerationStatus.SUCCEEDED;
        await this.notificationService.notifyUser({
            userId: record.userId,
            sceneCode: succeeded
                ? `${EXTENSION_ID}.generation.succeeded`
                : `${EXTENSION_ID}.generation.failed`,
            level: succeeded ? "success" : "error",
            linkUrl: `/extension/${EXTENSION_ID}/`,
            sourceType: "generation",
            sourceId: record.id,
            data: {
                taskName: record.modelName || record.modelId || "图片任务",
                modelName: record.modelName || record.modelId,
                reason: record.errorMessage || "请稍后重试或联系管理员",
                billingStatus: record.billingStatus,
                completedAt: record.completedAt?.toISOString(),
            },
        });
    }

    async list(query: QueryGenerationDto, userId: string) {
        const where = buildDefinedWhere<FindOptionsWhere<ImageGeneration>>({
            userId,
            prompt: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            status: query.status,
            modelConfigId: query.modelId,
            mode: query.mode,
        });

        return this.paginate(query, {
            where,
            order: { createdAt: "DESC" },
        });
    }

    async listForWeb(query: QueryGenerationDto, userId: string) {
        const page = await this.list(query, userId);
        return {
            ...page,
            items: page.items.map((item) => this.toPublicGeneration(item)),
        };
    }

    async listAll(query: QueryGenerationDto) {
        const where = buildDefinedWhere<FindOptionsWhere<ImageGeneration>>({
            prompt: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            status: query.status,
            modelConfigId: query.modelId,
            mode: query.mode,
        });

        return this.paginate(query, {
            where,
            order: { createdAt: "DESC" },
        });
    }

    async findOwnedById(id: string, userId: string) {
        const generation = await this.generationRepository.findOne({
            where: { id, userId } as FindOptionsWhere<ImageGeneration>,
        });

        if (!generation) {
            throw HttpErrorFactory.notFound("生成记录不存在");
        }

        return generation;
    }

    async findOwnedPublicById(id: string, userId: string) {
        return this.toPublicGeneration(await this.findOwnedById(id, userId));
    }

    async findById(id: string) {
        const generation = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<ImageGeneration>,
        });

        if (!generation) {
            throw HttpErrorFactory.notFound("生成记录不存在");
        }

        return generation;
    }

    async deleteOwnedById(id: string, userId: string) {
        const generation = await this.findOwnedById(id, userId);
        this.assertGenerationCanBeDeleted(generation);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async deleteById(id: string) {
        const generation = await this.findById(id);
        this.assertGenerationCanBeDeleted(generation);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async retry(id: string, userId: string) {
        const source = await this.findOwnedById(id, userId);
        return this.retryFromSource(source, userId);
    }

    async retryForWeb(id: string, userId: string) {
        return this.toPublicGeneration(await this.retry(id, userId));
    }

    async retryAsOwner(id: string) {
        const source = await this.findById(id);
        return this.retryFromSource(source, source.userId);
    }

    private async retryFromSource(source: ImageGeneration, userId: string) {
        await this.modelConfigService.findEnabledByModel(source.modelId);
        const hasReferenceImage = Boolean(
            source.sourceImages?.length || source.referenceImageUrl || source.referenceImageFileId,
        );

        return this.createAndGenerate(
            {
                prompt: source.prompt,
                negativePrompt: source.negativePrompt,
                referenceImageUrl: source.referenceImageUrl,
                referenceImageFileId: source.referenceImageFileId,
                sourceImages: source.sourceImages,
                maskImageUrl: source.maskImage?.url,
                maskImageFileId: source.maskImage?.fileId,
                modelId: source.modelConfigId || source.modelId,
                size: source.size,
                n: source.n,
                quality: source.quality,
                style: source.style,
                responseFormat: source.responseFormat,
                mode: hasReferenceImage ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE,
                outputFormat: source.outputFormat,
                background: source.background,
                outputCompression: source.outputCompression,
                inputFidelity: source.inputFidelity,
                moderation: source.moderation,
                seed: source.seed,
            },
            userId,
        );
    }

    private toPublicGeneration(record: ImageGeneration) {
        const recordWithSoftDelete = record as ImageGeneration & { deletedAt?: Date | null };
        const {
            userId: _userId,
            rawRequest: _rawRequest,
            rawResponse: _rawResponse,
            rawEvents: _rawEvents,
            baseURL: _baseURL,
            deletedAt: _deletedAt,
            ...publicRecord
        } = recordWithSoftDelete;
        return publicRecord;
    }

    async listImageModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    private assertGenerationCanBeDeleted(generation: ImageGeneration) {
        if ([ImageGenerationStatus.PENDING, ImageGenerationStatus.PROCESSING].includes(generation.status)) {
            throw HttpErrorFactory.badRequest("生成任务处理中，完成或失败后才能删除");
        }
    }

    async enhancePrompt(dto: PromptEnhanceDto) {
        if (dto.modelId) {
            try {
                const result = await this.aiModelService.generateText(dto.modelId, {
                    system: [
                        "You are a professional AI image prompt director.",
                        "Rewrite the user's idea into a concise, production-ready image generation prompt.",
                        "Return only the optimized prompt, no markdown, no JSON, no explanation.",
                        "Prefer clear English visual language even when the user input is Chinese.",
                        "Include subject, scene, composition, lighting, color, mood, camera angle, and material detail.",
                    ].join("\n"),
                    prompt: [
                        `Original prompt: ${this.sanitizeText(dto.prompt, 4000)}`,
                        dto.style ? `Style: ${dto.style}` : "",
                        "Optimized image prompt:",
                    ].filter(Boolean).join("\n"),
                    temperature: 0.7,
                });
                return {
                    prompt: this.normalizeOptimizedPrompt(result.text, dto.prompt),
                    source: "ai",
                };
            } catch (error) {
                this.logger.warn(`AI prompt enhancement fallback: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return {
            prompt: this.buildLocalEnhancedPrompt(dto.prompt, dto.style),
            source: "local",
        };
    }

    private async getUserPolicyUsage(userId: string) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const [activeCount, todayCount] = await Promise.all([
            this.generationRepository.count({
                where: {
                    userId,
                    status: In([ImageGenerationStatus.PENDING, ImageGenerationStatus.PROCESSING]),
                } as FindOptionsWhere<ImageGeneration>,
            }),
            this.generationRepository.count({
                where: {
                    userId,
                    createdAt: Between(startOfDay, endOfDay),
                } as FindOptionsWhere<ImageGeneration>,
            }),
        ]);

        return { activeCount, todayCount };
    }

    private async deductGenerationBilling(record: ImageGeneration, remark: string) {
        return this.withTransaction(async (manager) => {
            const locked = await manager.findOne(ImageGeneration, {
                where: { id: record.id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) {
                throw HttpErrorFactory.notFound("生成记录不存在");
            }
            if (locked.billingStatus !== ImageGenerationBillingStatus.PENDING) {
                return locked;
            }

            if (!locked.billingAmount || locked.billingAmount <= 0) {
                locked.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
                locked.progress = Math.max(locked.progress ?? 0, 15);
                return manager.save(ImageGeneration, locked);
            }

            const duplicateDeduction = await this.hasGenerationBillingLog(locked.id, ACTION.DEC, manager);
            if (!duplicateDeduction) {
                const amount = normalizePowerAmount(Number(locked.billingAmount));
                await this.billingService.deductUserPower({
                    userId: locked.userId,
                    amount,
                    remark,
                    associationNo: locked.id,
                    associationUserId: locked.userId,
                }, manager);
            }

            locked.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
            locked.progress = Math.max(locked.progress ?? 0, 15);
            return manager.save(ImageGeneration, locked);
        });
    }

    private async refundGenerationBilling(record: ImageGeneration, remark: string) {
        await this.withTransaction(async (manager) => {
            const locked = await manager.findOne(ImageGeneration, {
                where: { id: record.id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) {
                throw HttpErrorFactory.notFound("生成记录不存在");
            }
            if (!locked.billingAmount || locked.billingAmount <= 0) {
                return;
            }

            const wasDeducted =
                locked.billingStatus === ImageGenerationBillingStatus.DEDUCTED ||
                await this.hasGenerationBillingLog(locked.id, ACTION.DEC, manager);
            if (!wasDeducted) {
                return;
            }

            const alreadyRefunded =
                locked.billingStatus === ImageGenerationBillingStatus.REFUNDED ||
                await this.hasGenerationBillingLog(locked.id, ACTION.INC, manager);
            if (alreadyRefunded) {
                locked.billingStatus = ImageGenerationBillingStatus.REFUNDED;
                await manager.save(ImageGeneration, locked);
                record.billingStatus = locked.billingStatus;
                return;
            }

            const duplicateRefund = await this.hasGenerationBillingLog(locked.id, ACTION.INC, manager);
            if (!duplicateRefund) {
                const amount = normalizePowerAmount(Number(locked.billingAmount));
                await this.billingService.addUserPower({
                    userId: locked.userId,
                    amount,
                    remark,
                    associationNo: locked.id,
                    associationUserId: locked.userId,
                }, manager);
            }

            locked.billingStatus = ImageGenerationBillingStatus.REFUNDED;
            await manager.save(ImageGeneration, locked);
            record.billingStatus = locked.billingStatus;
        });
    }

    private async hasGenerationBillingLog(
        associationNo: string,
        action: (typeof ACTION)[keyof typeof ACTION],
        manager?: EntityManager,
    ) {
        return this.billingService.hasBillingLog({ associationNo, action }, manager);
    }

    private async generateWithProvider(
        record: ImageGeneration,
        modelConfig: ResolvedImageModelConfig,
        runtime: { apiKey: string; baseUrl: string },
        maxReferenceImageSizeMb: number,
    ) {
        const client = new OpenAIImageClient({
            apiKey: runtime.apiKey,
            baseURL: runtime.baseUrl,
        });
        const referenceImages = await this.resolveReferenceImages(record, maxReferenceImageSizeMb);
        const maskImage = await this.resolveStoredImage(record.maskImage, maxReferenceImageSizeMb, "遮罩图", record.userId);

        this.logger.log(
            `Generating image: model=${modelConfig.model} size=${record.size} n=${record.n} baseURL=${this.sanitizeBaseURL(runtime.baseUrl)}`,
        );

        return client.generate({
            model: modelConfig.externalModelId,
            prompt: this.buildProviderPrompt(record),
            n: record.n,
            size: record.size,
            quality: record.quality,
            style: record.style,
            responseFormat: record.responseFormat,
            referenceImages,
            maskImage,
            maxReferenceImageBytes: maxReferenceImageSizeMb * 1024 * 1024,
            requestContract: modelConfig.requestContract,
        });
    }

    private buildProviderPrompt(record: ImageGeneration): string {
        if (!record.negativePrompt?.trim()) return record.prompt;
        return `${record.prompt}\n\nAvoid: ${record.negativePrompt.trim()}`;
    }

    private buildLocalEnhancedPrompt(prompt: string, style?: string): string {
        const value = this.sanitizeText(prompt.trim(), 3800);
        const styleHint = style === "natural" ? "自然色彩，真实光影" : style === "vivid" ? "鲜明色彩，强视觉冲击" : "风格统一";
        return `${value}，${styleHint}，主体明确，构图完整，层次丰富，光影细腻，高细节，画面干净，背景协调`;
    }

    private normalizeOptimizedPrompt(value: string, fallback: string): string {
        return this.sanitizeText(value.trim().replace(/^["'`]+|["'`]+$/g, ""), 4000) || this.buildLocalEnhancedPrompt(fallback);
    }

    private async resolveReferenceImages(record: ImageGeneration, maxReferenceImageSizeMb: number) {
        const sources = record.sourceImages?.length
            ? record.sourceImages
            : [{ url: record.referenceImageUrl, fileId: record.referenceImageFileId }];
        const resolved = await Promise.all(
            sources.map((source, index) => this.resolveStoredImage(source, maxReferenceImageSizeMb, `参考图 ${index + 1}`, record.userId)),
        );
        return resolved.filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    private async resolveStoredImage(
        source: ImageSourceRecord | undefined,
        maxReferenceImageSizeMb: number,
        label: string,
        userId: string,
    ) {
        if (!source?.fileId) {
            return source?.url ? { url: source.url, source: source.url } : undefined;
        }

        const file = await this.fileUploadService.findOneById(source.fileId);
        this.assertPluginUploadOwnedByUser(file, userId, label);
        if (!file) {
            throw HttpErrorFactory.badRequest(`${label}文件不存在或无权访问`);
        }
        const mimeType = this.normalizeReferenceImageMimeType(file.mimeType, file.originalName);
        const maxBytes = maxReferenceImageSizeMb * 1024 * 1024;

        if (file.size > maxBytes) {
            throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxReferenceImageSizeMb}MB`);
        }

        const stream = await this.fileUploadService.createReadStream(source.fileId, { extensionId: "echoflow-image" });
        if (!stream) {
            throw HttpErrorFactory.badRequest(`${label}文件不存在或无法读取`);
        }

        const buffer = await this.readStreamToBuffer(stream as Readable);
        if (buffer.byteLength > maxBytes) {
            throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxReferenceImageSizeMb}MB`);
        }

        return {
            blob: new Blob([this.toArrayBuffer(buffer)], { type: mimeType }),
            filename: file.originalName || `reference.${this.extensionForMimeType(mimeType)}`,
            mimeType,
            size: buffer.byteLength,
            source: `file:${source.fileId}`,
        };
    }

    private assertPluginUploadOwnedByUser(
        file: { uploaderId?: string; extensionIdentifier?: string } | null | undefined,
        userId: string,
        label: string,
    ) {
        if (!file) {
            throw HttpErrorFactory.badRequest(`${label}文件不存在或无法读取`);
        }
        if (file.uploaderId !== userId) {
            throw HttpErrorFactory.badRequest(`${label}不属于当前用户`);
        }
        if (file.extensionIdentifier !== "echoflow-image") {
            throw HttpErrorFactory.badRequest(`${label}不属于当前插件上传文件`);
        }
    }

    private async normalizeGenerationRequest(dto: CreateGenerationDto, modelConfig: Pick<ImageModelConfig, "capabilities" | "defaultParams" | "requestContract">) {
        const sourceImages = await this.normalizeSourceImages(dto);
        const primarySourceImage = sourceImages[0];
        const referenceImageUrl = primarySourceImage?.url;
        const maskImageUrl = await this.normalizeReferenceImageUrl(dto.maskImageUrl, Boolean(dto.maskImageFileId));
        const hasReferenceImage = sourceImages.length > 0;
        const hasMaskImage = Boolean(maskImageUrl || dto.maskImageFileId);
        const mode =
            dto.mode === ImageGenerationMode.IMAGE_TO_IMAGE || hasReferenceImage
                ? ImageGenerationMode.IMAGE_TO_IMAGE
                : ImageGenerationMode.TEXT_TO_IMAGE;

        if (mode === ImageGenerationMode.IMAGE_TO_IMAGE && !hasReferenceImage) {
            throw HttpErrorFactory.badRequest("图生图需要提供参考图");
        }
        if (hasMaskImage && !hasReferenceImage) {
            throw HttpErrorFactory.badRequest("局部重绘需要同时提供参考图和遮罩图");
        }

        return {
            sourceImages,
            primarySourceImage,
            referenceImageUrl,
            maskImageUrl,
            hasReferenceImage,
            hasMaskImage,
            mode,
            size: dto.size ?? modelConfig.defaultParams?.size ?? "1024x1024",
            n: dto.n ?? modelConfig.defaultParams?.n ?? 1,
            quality: dto.quality ?? modelConfig.defaultParams?.quality,
            style: dto.style ?? modelConfig.defaultParams?.style,
            responseFormat: (dto.responseFormat ?? modelConfig.defaultParams?.responseFormat ?? ImageResponseFormat.B64_JSON) as ImageResponseFormat,
            outputFormat: dto.outputFormat ?? modelConfig.defaultParams?.outputFormat,
        };
    }

    private validateAllowedParams(
        dto: CreateGenerationDto,
        modelConfig: Pick<ImageModelConfig, "allowedParams" | "capabilities" | "defaultParams" | "requestContract">,
        sourceImages: ImageSourceRecord[],
    ) {
        const allowed = modelConfig.allowedParams ?? {};
        const capabilities = modelConfig.capabilities ?? {};
        const size = dto.size ?? modelConfig.defaultParams?.size;
        const quality = dto.quality ?? modelConfig.defaultParams?.quality;
        const style = dto.style ?? modelConfig.defaultParams?.style;
        const count = dto.n ?? modelConfig.defaultParams?.n ?? 1;

        const hasReferenceImage = sourceImages.length > 0;
        if (!hasReferenceImage && capabilities.textToImage === false) {
            throw HttpErrorFactory.badRequest("该模型未启用文生图能力");
        }
        if ((dto.mode === ImageGenerationMode.IMAGE_TO_IMAGE || hasReferenceImage) && !capabilities.imageToImage) {
            throw HttpErrorFactory.badRequest("该模型未启用图生图能力");
        }
        if (sourceImages.length > 1 && !capabilities.multiReference) {
            throw HttpErrorFactory.badRequest("该模型未启用多参考图能力");
        }
        if ((dto.maskImageUrl || dto.maskImageFileId) && capabilities.mask === false) {
            throw HttpErrorFactory.badRequest("该模型未启用局部重绘能力");
        }
        if (dto.negativePrompt && capabilities.negativePrompt === false) {
            throw HttpErrorFactory.badRequest("该模型未启用反向提示词");
        }
        if (dto.seed && !capabilities.seed) {
            throw HttpErrorFactory.badRequest("该模型未启用 seed 参数");
        }
        if (dto.outputFormat && !capabilities.outputFormat) {
            throw HttpErrorFactory.badRequest("该模型未启用输出格式参数");
        }
        if (dto.background && !capabilities.background) {
            throw HttpErrorFactory.badRequest("该模型未启用背景参数");
        }
        if (dto.moderation && !capabilities.moderation) {
            throw HttpErrorFactory.badRequest("该模型未启用安全等级参数");
        }
        if (dto.inputFidelity && !capabilities.inputFidelity) {
            throw HttpErrorFactory.badRequest("该模型未启用输入保真度参数");
        }
        if (modelConfig.requestContract === "responses" && (dto.maskImageUrl || dto.maskImageFileId)) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持局部重绘，请改用 Images API 模式");
        }
        if (modelConfig.requestContract === "responses" && (dto.n ?? 1) > 1) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持单次生成多张图片");
        }
        if (modelConfig.requestContract === "responses" && dto.seed) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持 seed 参数");
        }
        if (modelConfig.requestContract === "responses" && dto.inputFidelity) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持输入保真度参数");
        }
        if (modelConfig.requestContract === "responses" && dto.outputCompression !== undefined) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持输出压缩参数");
        }
        if (size && allowed.sizes?.length && !allowed.sizes.includes(size)) {
            throw HttpErrorFactory.badRequest("所选尺寸不在该模型允许范围内");
        }
        if (quality && allowed.qualities?.length && !allowed.qualities.includes(quality)) {
            throw HttpErrorFactory.badRequest("所选质量不在该模型允许范围内");
        }
        if (style && allowed.styles?.length && !allowed.styles.includes(style)) {
            throw HttpErrorFactory.badRequest("所选风格不在该模型允许范围内");
        }
        if (dto.outputFormat && allowed.outputFormats?.length && !allowed.outputFormats.includes(dto.outputFormat)) {
            throw HttpErrorFactory.badRequest("所选输出格式不在该模型允许范围内");
        }
        if (count > (allowed.maxImages ?? 4)) {
            throw HttpErrorFactory.badRequest(`该模型单次最多生成 ${allowed.maxImages ?? 4} 张图片`);
        }
    }

    private classifyFailure(error: unknown): string {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes("401") || message.includes("api key")) return "auth";
        if (message.includes("403") || message.includes("权限")) return "permission";
        if (message.includes("429")) return "rate_limit";
        if (message.includes("504") || message.includes("524") || message.includes("timeout") || message.includes("超时")) return "timeout";
        if (message.includes("policy") || message.includes("内容")) return "content_policy";
        return "upstream";
    }

    private sanitizeBaseURL(raw?: string): string {
        if (!raw) return "";
        try {
            const url = new URL(raw);
            return `${url.protocol}//${url.host}`;
        } catch {
            return "";
        }
    }

    /** Strip HTML tags and limit length to prevent XSS and storage abuse. */
    private sanitizeText(text: string, maxLength: number): string {
        return text.replace(/<[^>]*>/g, "").slice(0, maxLength);
    }

    /** Truncate text to maxLength for safe DB storage. */
    private truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
    }

    private compactRawPayload(payload: Record<string, unknown>): Record<string, unknown> {
        const MAX_STRING_LENGTH = 10_000;
        const MAX_TOTAL_LENGTH = 60_000;
        let stringTruncations = 0;
        let binaryOmissions = 0;

        try {
            const text = JSON.stringify(payload, (key, value) => {
                if (typeof value !== "string") return value;

                const lowerKey = key.toLowerCase();
                if (lowerKey.includes("b64_json") || lowerKey.includes("base64")) {
                    binaryOmissions++;
                    return "[omitted base64 payload]";
                }
                if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
                    binaryOmissions++;
                    return value.replace(/;base64,.+$/i, ";base64,[omitted]");
                }
                if (lowerKey.includes("image_url") && value.length > MAX_STRING_LENGTH) {
                    binaryOmissions++;
                    return "data:image/*;base64,[omitted]";
                }
                if (value.length > MAX_STRING_LENGTH) {
                    stringTruncations++;
                    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
                }
                return value;
            });

            if (text.length > MAX_TOTAL_LENGTH) {
                this.logger.warn(
                    `Raw image payload exceeded ${MAX_TOTAL_LENGTH} chars (actual ${text.length}), truncating`,
                );
                return {
                    _truncated: true,
                    _originalLength: text.length,
                    preview: text.slice(0, MAX_TOTAL_LENGTH),
                };
            }

            const result = safeJsonParse<Record<string, unknown>>(text);
            if (!result) return { preview: text.slice(0, MAX_TOTAL_LENGTH) };
            if (stringTruncations > 0) result._stringTruncations = stringTruncations;
            if (binaryOmissions > 0) result._binaryOmissions = binaryOmissions;
            return result;
        } catch {
            return { _truncated: true, _error: "raw payload is not serializable" };
        }
    }

    private async storeResultImages(
        generationId: string,
        images: Array<{ url?: string; b64Json?: string; mimeType?: string; revisedPrompt?: string }>,
    ) {
        const storageFiles: Array<{ url: string; mimeType: string; path: string; size: number }> = [];
        const storedImages: Array<{ url?: string; mimeType?: string; revisedPrompt?: string }> = [];

        for (const [index, img] of images.entries()) {
            if (img.url) {
                storedImages.push({
                    url: await this.normalizeResultImageUrl(img.url),
                    mimeType: img.mimeType,
                    revisedPrompt: img.revisedPrompt,
                });
                continue;
            }

            if (!img.b64Json) {
                storedImages.push({
                    mimeType: img.mimeType,
                    revisedPrompt: img.revisedPrompt,
                });
                continue;
            }

            const mimeType = this.normalizeGeneratedImageMimeType(img.mimeType);
            const extension = this.extensionForMimeType(mimeType);
            const now = new Date();
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const relativePath = path.posix.join("generated", year, month, `${generationId}-${index + 1}.${extension}`);
            const buffer = Buffer.from(this.stripBase64DataUrl(img.b64Json), "base64");

            await this.fileStorageService.saveBuffer(
                buffer,
                {
                    path: path.posix.dirname(relativePath),
                    fileName: path.posix.basename(relativePath),
                    fullPath: relativePath,
                },
                { extensionId: "echoflow-image" },
            );

            const url = `/echoflow-image/uploads/${relativePath}`;
            const storageFile = {
                url,
                mimeType,
                path: relativePath,
                size: buffer.byteLength,
            };

            storageFiles.push(storageFile);
            storedImages.push({
                url,
                mimeType,
                revisedPrompt: img.revisedPrompt,
            });
        }

        return { images: storedImages, storageFiles };
    }

    private toArrayBuffer(buffer: Buffer): ArrayBuffer {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }

    private async normalizeResultImageUrl(raw: string): Promise<string> {
        try {
            const url = new URL(await assertPublicHttpUrl(raw, { label: "图片结果 URL" }));
            return url.toString();
        } catch {
            throw HttpErrorFactory.badRequest("图片服务返回了不安全的图片地址");
        }
    }

    private async normalizeReferenceImageUrl(raw?: string, trustedFile = false): Promise<string | undefined> {
        if (trustedFile) return undefined;
        if (!raw) return undefined;
        const value = raw.trim();
        if (!value) return undefined;

        try {
            const url = new URL(await assertPublicHttpUrl(value, { label: "参考图 URL" }));
            return url.toString().slice(0, 2000);
        } catch {
            throw HttpErrorFactory.badRequest("参考图地址无效或不安全；平台上传文件请提交 fileId");
        }
    }

    private async normalizeSourceImages(dto: CreateGenerationDto): Promise<ImageSourceRecord[]> {
        const images = [
            ...(dto.sourceImages ?? []),
            ...(dto.referenceImageUrl || dto.referenceImageFileId
                ? [{ url: dto.referenceImageUrl, fileId: dto.referenceImageFileId }]
                : []),
        ];
        const seen = new Set<string>();
        const normalized: ImageSourceRecord[] = [];

        for (const item of images) {
            const fileId = item.fileId;
            const url = fileId ? undefined : await this.normalizeReferenceImageUrl(item.url);
            const key = fileId || url;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            normalized.push({ url, fileId });
        }

        if (normalized.length > 10) {
            throw HttpErrorFactory.badRequest("参考图最多上传 10 张");
        }

        return normalized;
    }

    private normalizeGeneratedImageMimeType(raw?: string): string {
        const mimeType = raw?.split(";")[0]?.toLowerCase();
        if (mimeType && ["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
            return mimeType;
        }
        return "image/png";
    }

    private normalizeReferenceImageMimeType(raw?: string, filename?: string): string {
        const mimeType = raw?.split(";")[0]?.trim().toLowerCase();
        if (mimeType && ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) {
            return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
        }

        const lowerName = filename?.toLowerCase() ?? "";
        if (lowerName.endsWith(".png")) return "image/png";
        if (lowerName.endsWith(".webp")) return "image/webp";
        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";

        throw HttpErrorFactory.badRequest("参考图格式仅支持 png、jpg、webp");
    }

    private extensionForMimeType(mimeType: string): string {
        if (mimeType === "image/jpeg") return "jpg";
        if (mimeType === "image/webp") return "webp";
        return "png";
    }

    private stripBase64DataUrl(value: string): string {
        return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
    }

    private async readStreamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    private isUniqueConstraintError(error: unknown): boolean {
        const dbError = error as { code?: string; constraint?: string; message?: string };
        return (
            dbError?.code === "23505" ||
            dbError?.constraint === "uq_image_generation_user_request_key" ||
            dbError?.message?.includes("uq_image_generation_user_request_key") === true
        );
    }

}

export const generationModuleEntities = [
    ImageGeneration,
    ImageModelConfig,
    ImageBillingRule,
    ImagePolicyConfig,
    ImagePromptTemplate,
];

export const generationModuleProviders = [
    GenerationService,
];
