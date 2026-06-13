import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core";
import { FileUploadService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel, AiProvider, Secret, SecretTemplate, User } from "@buildingai/db/entities";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThan, Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { ExtensionBillingService, PublicAiModelService } from "@buildingai/extension-sdk";
import { buildWhere } from "@buildingai/utils";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
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
import { ImageModelConfig } from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../../db/entities/image-policy-config.entity";
import { ImagePromptTemplate } from "../../../db/entities/image-prompt-template.entity";
import { BillingRuleService } from "../../billing/services/billing-rule.service";
import { ModelConfigService } from "../../config/services/model-config.service";
import { PolicyService } from "../../policy/services/policy.service";
import { CreateGenerationDto, PromptEnhanceDto, QueryGenerationDto } from "../dto";
import { OpenAIImageClient } from "./openai-image-client";

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
    ) {
        super(generationRepository);
    }

    onModuleInit() {
        setTimeout(() => {
            void this.recoverJobs().catch((error) => {
                this.logger.error("Recover generation jobs failed", error);
            });
        }, 3000);
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

        // --- Validate plugin model config (fail fast before any DB writes) ---
        const modelConfig = await this.modelConfigService.findEnabledById(dto.modelId);
        const modelInfo = await this.aiModelService.getModelInfo(modelConfig.aiModelId);
        const normalizedRequest = this.normalizeGenerationRequest(dto, modelConfig);
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
        this.validateAllowedParams(normalizedDto, modelConfig);
        const usage = await this.getUserPolicyUsage(userId);
        const policy = await this.policyService.validateGeneration(modelConfig.id, normalizedDto, usage.activeCount, usage.todayCount);

        const billingAmount = await this.billingRuleService.calculateAmount({
            modelConfigId: modelConfig.id,
            mode: normalizedRequest.mode,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
        });
        const providerConfig = this.flattenProviderConfig(
            await this.aiModelService.getProviderConfig(modelConfig.aiModelId),
        );

        const provider = await this.aiModelService.getProviderAdapter(modelConfig.aiModelId, providerConfig);
        if (!provider.supports("image")) {
            throw HttpErrorFactory.badRequest("所选模型不支持图片生成，请选择图片模型");
        }

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
        const baseURLSummary = this.sanitizeBaseURL(providerConfig.baseURL);

        const record = this.generationRepository.create({
            userId,
            requestKey: dto.requestKey,
            modelConfigId: modelConfig.id,
            mode: normalizedRequest.mode,
            status: ImageGenerationStatus.PENDING,
            billingStatus: ImageGenerationBillingStatus.PENDING,
            prompt: this.sanitizeText(dto.prompt, 4000),
            negativePrompt: dto.negativePrompt ? this.sanitizeText(dto.negativePrompt, 2000) : undefined,
            referenceImageUrl: normalizedRequest.referenceImageUrl,
            referenceImageFileId: normalizedRequest.primarySourceImage?.fileId,
            modelId: modelConfig.aiModelId,
            modelName: modelConfig.displayName || modelInfo.name,
            provider: modelInfo.provider?.provider,
            baseURL: baseURLSummary,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
            style: normalizedRequest.style,
            responseFormat: normalizedRequest.responseFormat,
            apiMode: modelConfig.apiMode,
            requestPolicy: modelConfig.requestPolicy,
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

        this.runGenerationInBackground(saved.id);
        return saved;
    }

    async recoverJobs() {
        const now = Date.now();
        const staleProcessingDate = new Date(now - 30 * 60 * 1000);
        const resumableDate = new Date(now - 2 * 60 * 1000);

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
            item.progress = Math.min(item.progress ?? 0, 10);
            await this.generationRepository.save(item);
            this.runGenerationInBackground(item.id);
            resumed += 1;
        }

        return {
            resumed,
            timedOut: staleProcessing.length,
        };
    }

    async executeGenerationJob(id: string) {
        const saved = await this.generationRepository.findOne({
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

        const modelConfig = saved.modelConfigId
            ? await this.modelConfigService.findEnabledById(saved.modelConfigId)
            : undefined;
        const modelInfo = await this.aiModelService.getModelInfo(saved.modelId);
        const providerConfig = this.flattenProviderConfig(
            await this.aiModelService.getProviderConfig(saved.modelId),
        );
        const provider = await this.aiModelService.getProviderAdapter(saved.modelId, providerConfig);
        if (!provider.supports("image")) {
            throw HttpErrorFactory.badRequest("所选模型不支持图片生成，请选择图片模型");
        }
        const modelConfigId = modelConfig?.id ?? saved.modelConfigId ?? "";
        const policy = await this.policyService.resolvePolicy(modelConfigId);
        const billingRule = await this.billingRuleService.resolveRule(modelConfigId);

        saved.status = ImageGenerationStatus.PROCESSING;
        saved.startedAt = startedAt;
        saved.progress = Math.max(saved.progress ?? 0, 5);

        // --- Stage 2: Deduct power ---
        try {
            if (saved.billingStatus === ImageGenerationBillingStatus.PENDING) {
                await this.billingService.deductUserPower({
                    userId: saved.userId,
                    amount: saved.billingAmount,
                    remark: `Echoflow Image: ${modelConfig?.displayName || modelInfo.name || modelInfo.model}`,
                    associationNo: saved.id,
                    associationUserId: saved.userId,
                });
                saved.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
                saved.progress = 15;
                await this.generationRepository.save(saved);
            }
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
            const result = await this.generateWithProvider(saved, modelInfo, providerConfig, policy.maxReferenceImageSizeMb);
            const storedResult = await this.storeResultImages(saved.id, result.images);
            saved.resultImages = storedResult.images;
            saved.storageFiles = storedResult.storageFiles;
            saved.rawRequest = result.rawRequest;
            saved.rawResponse = result.rawResponse;
            saved.status = ImageGenerationStatus.SUCCEEDED;
            saved.progress = 100;
            saved.completedAt = new Date();
            await this.generationRepository.save(saved);
            this.logger.log(`Generation ${saved.id} succeeded: ${result.images.length} images`);
            return saved;
        } catch (generateError) {
            const rawMessage =
                generateError instanceof Error ? generateError.message : "Image generation failed";
            saved.status = ImageGenerationStatus.FAILED;
            saved.errorMessage = this.truncateText(rawMessage, 2000);
            saved.failureCategory = this.classifyFailure(generateError);
            saved.completedAt = new Date();

            if (saved.billingStatus === ImageGenerationBillingStatus.DEDUCTED && billingRule.refundOnFailure !== false) {
                try {
                    await this.billingService.addUserPower({
                        userId: saved.userId,
                        amount: saved.billingAmount,
                        remark: `Refund for failed generation ${saved.id}`,
                        associationNo: saved.id,
                        associationUserId: saved.userId,
                    });
                    saved.billingStatus = ImageGenerationBillingStatus.REFUNDED;
                } catch (refundError) {
                    saved.billingStatus = ImageGenerationBillingStatus.DEDUCTED;
                    saved.errorMessage = this.truncateText(
                        `${saved.errorMessage} (退款失败，请联系管理员)`,
                        2000,
                    );
                    this.logger.error(`Refund failed for generation ${saved.id}`, refundError);
                }
            }

            await this.generationRepository.save(saved);
            this.logger.warn(`Generation ${saved.id} failed: ${saved.errorMessage}`);
            return saved;
        }
    }

    private runGenerationInBackground(id: string) {
        setTimeout(() => {
            void this.executeGenerationJob(id).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Background generation ${id} crashed: ${message}`, error);
                void this.markGenerationCrashed(id, error);
            });
        }, 0);
    }

    private async markGenerationCrashed(id: string, error: unknown) {
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

        const billingRule = await this.billingRuleService.resolveRule(saved.modelConfigId ?? "");
        if (saved.billingStatus === ImageGenerationBillingStatus.DEDUCTED && billingRule.refundOnFailure !== false) {
            try {
                await this.billingService.addUserPower({
                    userId: saved.userId,
                    amount: saved.billingAmount,
                    remark: `Refund for crashed generation ${saved.id}`,
                    associationNo: saved.id,
                    associationUserId: saved.userId,
                });
                saved.billingStatus = ImageGenerationBillingStatus.REFUNDED;
            } catch (refundError) {
                this.logger.error(`Crash refund failed for generation ${saved.id}`, refundError);
            }
        }

        await this.generationRepository.save(saved);
    }

    async list(query: QueryGenerationDto, userId: string) {
        const where = buildWhere<ImageGeneration>({
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

    async listAll(query: QueryGenerationDto) {
        const where = buildWhere<ImageGeneration>({
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

    async retryAsOwner(id: string) {
        const source = await this.findById(id);
        return this.retryFromSource(source, source.userId);
    }

    private async retryFromSource(source: ImageGeneration, userId: string) {
        // Validate the source model still exists and supports image generation
        try {
            const modelInfo = await this.aiModelService.getModelInfo(source.modelId);
            const providerConfig = this.flattenProviderConfig(
                await this.aiModelService.getProviderConfig(source.modelId),
            );
            const provider = await this.aiModelService.getProviderAdapter(source.modelId, providerConfig);
            if (!provider.supports("image")) {
                throw HttpErrorFactory.badRequest("原模型已不再支持图片生成，请选择其他模型");
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("not found")) {
                throw HttpErrorFactory.badRequest("原模型已被删除，请选择其他模型后重新生成");
            }
            throw error;
        }

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
                mode: source.referenceImageUrl || source.referenceImageFileId ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE,
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
                const modelConfig = await this.modelConfigService.findEnabledById(dto.modelId);
                const modelInfo = await this.aiModelService.getModelInfo(modelConfig.aiModelId);
                const providerConfig = this.flattenProviderConfig(
                    await this.aiModelService.getProviderConfig(modelConfig.aiModelId),
                );
                const client = new OpenAIImageClient({
                    apiKey: providerConfig.apiKey,
                    baseURL: providerConfig.baseURL,
                });
                const prompt = await client.enhancePrompt({
                    model: modelInfo.model,
                    prompt: this.sanitizeText(dto.prompt, 4000),
                    style: dto.style,
                });
                return {
                    prompt,
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

    private async generateWithProvider(
        record: ImageGeneration,
        modelInfo: AiModel,
        providerConfig: Record<string, string>,
        maxReferenceImageSizeMb: number,
    ) {
        const client = new OpenAIImageClient({
            apiKey: providerConfig.apiKey,
            baseURL: providerConfig.baseURL,
        });
        const referenceImages = await this.resolveReferenceImages(record, maxReferenceImageSizeMb);
        const maskImage = await this.resolveStoredImage(record.maskImage, maxReferenceImageSizeMb, "遮罩图");

        this.logger.log(
            `Generating image: model=${modelInfo.model} size=${record.size} n=${record.n} baseURL=${this.sanitizeBaseURL(providerConfig.baseURL)}`,
        );

        return client.generate({
            model: modelInfo.model,
            prompt: this.buildProviderPrompt(record),
            n: record.n,
            size: record.size,
            quality: record.quality,
            style: record.style,
            responseFormat: record.responseFormat,
            referenceImages,
            maskImage,
            maxReferenceImageBytes: maxReferenceImageSizeMb * 1024 * 1024,
            apiMode: record.apiMode === "responses" ? "responses" : "images",
            seed: record.seed,
            outputFormat: record.outputFormat,
            background: record.background,
            outputCompression: record.outputCompression,
            inputFidelity: record.inputFidelity,
            moderation: record.moderation,
            requestPolicy: record.requestPolicy,
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

    private async resolveReferenceImages(record: ImageGeneration, maxReferenceImageSizeMb: number) {
        const sources = record.sourceImages?.length
            ? record.sourceImages
            : [{ url: record.referenceImageUrl, fileId: record.referenceImageFileId }];
        const resolved = await Promise.all(
            sources.map((source, index) => this.resolveStoredImage(source, maxReferenceImageSizeMb, `参考图 ${index + 1}`)),
        );
        return resolved.filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    private async resolveStoredImage(source: ImageSourceRecord | undefined, maxReferenceImageSizeMb: number, label: string) {
        if (!source?.fileId) {
            return source?.url ? { url: source.url, source: source.url } : undefined;
        }

        const file = await this.fileUploadService.findOneById(source.fileId);
        const mimeType = this.normalizeReferenceImageMimeType(file.mimeType, file.originalName);
        const maxBytes = maxReferenceImageSizeMb * 1024 * 1024;

        if (file.size > maxBytes) {
            throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxReferenceImageSizeMb}MB`);
        }

        const stream = await this.fileUploadService.createReadStream(source.fileId);
        if (!stream) {
            throw HttpErrorFactory.badRequest(`${label}文件不存在或无法读取`);
        }

        const buffer = await this.readStreamToBuffer(stream as Readable);
        if (buffer.byteLength > maxBytes) {
            throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxReferenceImageSizeMb}MB`);
        }

        return {
            blob: new Blob([buffer], { type: mimeType }),
            filename: file.originalName || `reference.${this.extensionForMimeType(mimeType)}`,
            mimeType,
            size: buffer.byteLength,
            source: `file:${source.fileId}`,
        };
    }

    private normalizeGenerationRequest(dto: CreateGenerationDto, modelConfig: ImageModelConfig) {
        const sourceImages = this.normalizeSourceImages(dto);
        const primarySourceImage = sourceImages[0];
        const referenceImageUrl = primarySourceImage?.url;
        const maskImageUrl = this.normalizeReferenceImageUrl(dto.maskImageUrl);
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

    private validateAllowedParams(dto: CreateGenerationDto, modelConfig: ImageModelConfig) {
        const allowed = modelConfig.allowedParams ?? {};
        const capabilities = modelConfig.capabilities ?? {};
        const size = dto.size ?? modelConfig.defaultParams?.size;
        const quality = dto.quality ?? modelConfig.defaultParams?.quality;
        const style = dto.style ?? modelConfig.defaultParams?.style;
        const count = dto.n ?? modelConfig.defaultParams?.n ?? 1;
        const sourceImages = this.normalizeSourceImages(dto);

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
        if (modelConfig.apiMode === "responses" && (dto.maskImageUrl || dto.maskImageFileId)) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持局部重绘，请改用 Images API 模式");
        }
        if (modelConfig.apiMode === "responses" && (dto.n ?? 1) > 1) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持单次生成多张图片");
        }
        if (modelConfig.apiMode === "responses" && dto.seed) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持 seed 参数");
        }
        if (modelConfig.apiMode === "responses" && dto.inputFidelity) {
            throw HttpErrorFactory.badRequest("Responses API 暂不支持输入保真度参数");
        }
        if (modelConfig.apiMode === "responses" && dto.outputCompression !== undefined) {
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

    private flattenProviderConfig(config: Record<string, unknown>): Record<string, string> {
        const normalized: Record<string, string> = {};

        Object.entries(config).forEach(([key, item]) => {
            if (typeof item === "string") {
                normalized[key] = item;
                return;
            }

            const value = (item as { value?: unknown } | undefined)?.value;
            if (typeof value === "string") {
                normalized[key] = value;
            }
        });

        const apiKey = normalized.apiKey || normalized.api_key || normalized.API_KEY || "";
        const baseURL = normalized.baseURL || normalized.baseUrl || normalized.base_url || "";

        return { apiKey, baseURL };
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

    private async storeResultImages(
        generationId: string,
        images: Array<{ url?: string; b64Json?: string; mimeType?: string; revisedPrompt?: string }>,
    ) {
        const storageFiles = [];
        const storedImages = [];

        for (const [index, img] of images.entries()) {
            if (img.url) {
                storedImages.push({
                    url: this.normalizeResultImageUrl(img.url),
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
            const absolutePath = path.join(this.getExtensionUploadRoot(), relativePath);
            const buffer = Buffer.from(this.stripBase64DataUrl(img.b64Json), "base64");

            await mkdir(path.dirname(absolutePath), { recursive: true });
            await writeFile(absolutePath, buffer);

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

    private normalizeResultImageUrl(raw: string): string {
        try {
            const url = new URL(raw);
            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("unsupported protocol");
            }
            return url.toString();
        } catch {
            throw HttpErrorFactory.badRequest("图片服务返回了不安全的图片地址");
        }
    }

    private normalizeReferenceImageUrl(raw?: string): string | undefined {
        if (!raw) return undefined;
        const value = raw.trim();
        if (!value) return undefined;

        if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
            return value.slice(0, 2000);
        }

        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("unsupported protocol");
            }
            return url.toString().slice(0, 2000);
        } catch {
            throw HttpErrorFactory.badRequest("参考图地址无效或不安全");
        }
    }

    private normalizeSourceImages(dto: CreateGenerationDto): ImageSourceRecord[] {
        const images = [
            ...(dto.sourceImages ?? []),
            ...(dto.referenceImageUrl || dto.referenceImageFileId
                ? [{ url: dto.referenceImageUrl, fileId: dto.referenceImageFileId }]
                : []),
        ];
        const seen = new Set<string>();
        const normalized: ImageSourceRecord[] = [];

        for (const item of images) {
            const url = this.normalizeReferenceImageUrl(item.url);
            const fileId = item.fileId;
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

    private getExtensionUploadRoot(): string {
        return path.join(process.cwd(), "..", "..", "extensions", "echoflow-image", "storage", "uploads");
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
    User,
    AccountLog,
    AiModel,
    AiProvider,
    Secret,
    SecretTemplate,
];

export const generationModuleProviders = [
    GenerationService,
    PublicAiModelService,
    ExtensionBillingService,
    SecretService,
];
