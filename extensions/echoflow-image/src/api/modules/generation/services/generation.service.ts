import { BaseService } from "@buildingai/base";
import { StorageType } from "@buildingai/constants";
import { ACTION } from "@buildingai/constants/shared/account-log.constants";
import type { BooleanNumberType } from "@buildingai/constants/shared/status-codes.constant";
import { FileStorageService, FileUploadService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { File, FileType, StorageConfig, User } from "@buildingai/db/entities";
import type { EntityManager, FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThan, Like, Raw, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    PublicAiModelService,
    assertPublicHttpUrl,
    buildDefinedWhere,
    downloadPublicHttpUrl,
    safeJsonParse,
} from "@buildingai/extension-sdk";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@buildingai/core/@nestjs/schedule";
import type { Queue } from "bullmq";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";

import {
    ImageGeneration,
    ImageGenerationBillingStatus,
    type GeneratedStorageFileRecord,
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
    buildImageRetryPayload,
    canReserveImageGeneration,
    deriveImageRetryRequestKey,
    hasImageGenerationRequestKey,
    resolveImageFailureBilling,
    shouldDeductImageGeneration,
    shouldRecoverImageRefund,
    shouldRefundImageGeneration,
} from "./image-generation-billing-rules";
import {
    canCompleteImageGeneration,
    canFailImageGeneration,
    IMAGE_PENDING_RESUME_AFTER_MS,
    IMAGE_PROCESSING_TIMEOUT_MS,
    canRetryImageGeneration,
    getResumedImageProgress,
    shouldTimeoutImageGeneration,
} from "./image-generation-recovery-rules";

const LOCK_TIMEOUT = 'SET LOCAL lock_timeout = 3000';

const EXTENSION_ID = "echoflow-image";
const PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), "../../extensions", EXTENSION_ID, "storage", "private");
const GENERATED_RESULT_DIRECTORY = "generated";
const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_GENERATED_BATCH_BYTES = MAX_GENERATED_IMAGE_BYTES * 4;
const MAX_GENERATED_BASE64_INPUT_LENGTH = Math.ceil(MAX_GENERATED_IMAGE_BYTES * 4 / 3) + 256;

type GenerationFailureOptions = {
    errorMessage?: string;
    billingStatus?: ImageGenerationBillingStatus;
    refundOnFailure?: boolean;
    requireStaleProcessing?: boolean;
};

type GenerationCompletionResult = {
    record: ImageGeneration;
    transitioned: boolean;
};

@Injectable()
export class GenerationService extends BaseService<ImageGeneration> implements OnModuleInit {
    protected readonly logger = new Logger(GenerationService.name);

    constructor(
        @InjectRepository(ImageGeneration)
        private readonly generationRepository: Repository<ImageGeneration>,
        @InjectRepository(StorageConfig)
        private readonly storageConfigRepository: Repository<StorageConfig>,
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

    @Cron("*/5 * * * *")
    async scheduledRecoverJobs() {
        await this.recoverJobs();
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
     * 1. Validate input and model
     * 2. Create one request-key-protected task while holding the user reservation lock
     * 3. Deduct power in the worker transaction
     * 4. Generate image outside the database transaction
     * 5. Persist terminal state and settle failure refunds by generation association
     */
    async createAndGenerate(dto: CreateGenerationDto, userId: string) {
        if (!hasImageGenerationRequestKey(dto.requestKey)) {
            throw HttpErrorFactory.badRequest("缺少有效请求幂等键");
        }

        const existing = await this.generationRepository.findOne({
            where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<ImageGeneration>,
        });
        if (existing) {
            this.logger.warn(`Duplicate requestKey ${dto.requestKey} for user ${userId}, returning existing ${existing.id}`);
            return existing;
        }

        const effectiveConfig = await this.modelConfigService.findEnabledById(dto.modelId);
        this.assertRuntimeGenerationSupported(this.getRequestedReservedCapabilities(dto));
        const normalizedRequest = await this.normalizeGenerationRequest(dto, effectiveConfig, userId);
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
        const policy = await this.policyService.validateGeneration(modelConfigId, normalizedDto, usage.todayCount);
        await this.assertUploadFilesWithinLimit(
            [
                ...normalizedRequest.sourceImages.map((source, index) => ({ fileId: source.fileId, label: `参考图 ${index + 1}` })),
                normalizedRequest.hasMaskImage ? { fileId: dto.maskImageFileId, label: "遮罩图" } : undefined,
            ],
            userId,
            policy.maxReferenceImageSizeMb,
        );

        const billingAmount = await this.billingRuleService.calculateAmount({
            modelConfigId,
            mode: normalizedRequest.mode,
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
        });

        const record = this.generationRepository.create({
            userId,
            requestKey: dto.requestKey,
            mode: normalizedRequest.mode,
            status: ImageGenerationStatus.PENDING,
            billingStatus: ImageGenerationBillingStatus.PENDING,
            prompt: this.sanitizeText(dto.prompt, 4000),
            negativePrompt: dto.negativePrompt ? this.sanitizeText(dto.negativePrompt, 2000) : undefined,
            referenceImageUrl: normalizedRequest.referenceImageUrl,
            referenceImageFileId: normalizedRequest.primarySourceImage?.fileId,
            modelId: effectiveConfig.id,
            modelName: effectiveConfig.displayName,
            provider: effectiveConfig.provider,
            baseURL: "",
            size: normalizedRequest.size,
            n: normalizedRequest.n,
            quality: normalizedRequest.quality,
            style: normalizedRequest.style,
            responseFormat: normalizedRequest.responseFormat,
            apiMode: "ai-sdk-image",
            requestPolicy: "ai-sdk-image",
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
            stagedStorageFiles: [],
            rawEvents: [],
            progress: 0,
            billingAmount,
        });

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        let saved: ImageGeneration;
        try {
            saved = await this.withTransaction(async (manager) => {
                await manager.query(LOCK_TIMEOUT);
                const user = await manager.findOne(User, {
                    where: { id: userId },
                    lock: { mode: "pessimistic_write" },
                });
                if (!user) throw HttpErrorFactory.notFound("用户不存在");
                if (dto.requestKey) {
                    const existing = await manager.findOne(ImageGeneration, {
                        where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<ImageGeneration>,
                    });
                    if (existing) return existing;
                }

                const activeCount = await manager.count(ImageGeneration, {
                    where: {
                        userId,
                        status: In([ImageGenerationStatus.PENDING, ImageGenerationStatus.PROCESSING]),
                    } as FindOptionsWhere<ImageGeneration>,
                });
                if (!canReserveImageGeneration(activeCount, policy.maxConcurrentJobsPerUser)) {
                    throw HttpErrorFactory.badRequest("当前已有生成任务处理中，请稍后再试");
                }
                const todayCount = await manager.count(ImageGeneration, {
                    where: {
                        userId,
                        createdAt: Between(startOfToday, endOfToday),
                    } as FindOptionsWhere<ImageGeneration>,
                });
                if (todayCount >= policy.dailyJobsPerUser) {
                    throw HttpErrorFactory.badRequest("今日生成次数已达上限");
                }

                return manager.save(ImageGeneration, record);
            });
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

    async createAndGenerateForConsole(dto: CreateGenerationDto, userId: string) {
        return this.toConsoleGeneration(await this.createAndGenerate(dto, userId));
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
            await this.markGenerationCrashed(item.id, new Error("生成任务超时，已自动终止"), {
                requireStaleProcessing: true,
            });
        }

        const refundCandidates = await this.generationRepository.find({
            where: {
                status: ImageGenerationStatus.FAILED,
                billingStatus: ImageGenerationBillingStatus.DEDUCTED,
                rawResponse: Raw((alias) => `${alias}->'metadata'->>'refundRequired' = 'true'`),
            } as FindOptionsWhere<ImageGeneration>,
            order: { updatedAt: "ASC" },
            take: 20,
        });
        for (const item of refundCandidates) {
            try {
                await this.refundGenerationBilling(item, `Recovery refund for failed generation ${item.id}`);
            } catch (refundError) {
                await this.recordRefundFailure(item, refundError);
            }
        }

        const failedGenerations = await this.generationRepository.find({
            where: {
                status: ImageGenerationStatus.FAILED,
                stagedStorageFiles: Raw((alias) => `jsonb_array_length(${alias}) > 0`),
            } as FindOptionsWhere<ImageGeneration>,
            order: { updatedAt: "DESC" },
            take: 20,
        });
        for (const item of failedGenerations) {
            await this.reclaimStagedResultFiles(item.id);
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
            const claimed = await this.claimGenerationForRecovery(item.id);
            if (claimed) {
                await this.enqueueGenerationJob(item.id);
                resumed += 1;
            }
        }

        return {
            resumed,
            timedOut: staleProcessing.length,
        };
    }

    private async claimGenerationForRecovery(generationId: string) {
        return this.generationRepository.manager.transaction(async (entityManager) => {
            await entityManager.query(LOCK_TIMEOUT);
            const generation = await entityManager.findOne(ImageGeneration, {
                where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!generation || generation.status !== ImageGenerationStatus.PENDING) {
                return null;
            }
            const now = Date.now();
            const resumableDate = new Date(now - IMAGE_PENDING_RESUME_AFTER_MS);
            if (generation.updatedAt && generation.updatedAt > resumableDate) {
                return null;
            }
            await entityManager.update(ImageGeneration, generation.id, {
                status: ImageGenerationStatus.PENDING,
                progress: getResumedImageProgress(generation.progress),
                updatedAt: new Date(),
            });
            return generation;
        });
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

        if (!saved.modelId) {
            await this.markGenerationCrashed(id, new Error("生成记录缺少模型配置，无法执行"));
            throw HttpErrorFactory.badRequest("生成记录缺少模型配置");
        }

        const modelConfig = await this.modelConfigService.findEnabledById(saved.modelId, true);
        const policy = await this.policyService.resolvePolicy(modelConfig.id);

        try {
            await this.assertPrivateResultStorageSupported();
            await this.generationRepository.update(
                { id, status: ImageGenerationStatus.PROCESSING } as FindOptionsWhere<ImageGeneration>,
                { progress: 30 },
            );
            const result = await this.generateWithProvider(saved, modelConfig, policy.maxReferenceImageSizeMb);
            const storedResult = await this.storeResultImages(id, result.images);
            try {
                const completion = await this.completeGeneration(
                    id,
                    storedResult,
                    result.rawRequest,
                    result.rawResponse,
                    `Echoflow Image: ${modelConfig.displayName || modelConfig.model}`,
                );

                if (!completion.transitioned) {
                    await this.reclaimUncommittedResultFiles(id, storedResult.storageFiles);
                    if (completion.record.status === ImageGenerationStatus.FAILED && this.getImageBillingMetadata(completion.record).refundRequired === true) {
                        try {
                            await this.refundGenerationBilling(completion.record, `Late worker refund for generation ${id}`);
                        } catch (refundError) {
                            await this.recordRefundFailure(completion.record, refundError);
                        }
                    }
                    return this.findById(id);
                }

                this.logger.log(`Generation ${id} succeeded: ${storedResult.images.length} images`);
                await this.notifyTerminalStatus(completion.record);
                return completion.record;
            } catch (completionError) {
                await this.cleanupStoredResultFiles(storedResult.storageFiles);
                throw completionError;
            }
        } catch (generateError) {
            const failed = await this.markGenerationCrashed(id, generateError);
            if (!failed) {
                throw generateError;
            }
            this.logger.warn(`Generation ${id} failed: ${failed.errorMessage}`);
            return failed;
        }
    }

    private async assertPrivateResultStorageSupported(): Promise<void> {
        const storageConfig = await this.storageConfigRepository.findOne({ where: { isActive: true } });
        if (!storageConfig || storageConfig.storageType !== StorageType.LOCAL) {
            throw HttpErrorFactory.badRequest("当前存储配置不支持受控图片结果");
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
        } catch {
            this.logger.error(`Queue image generation ${id} failed`);
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
            negativePrompt: false,
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

    async markGenerationCrashed(
        id: string,
        error: unknown,
        options: GenerationFailureOptions = {},
    ): Promise<ImageGeneration | null> {
        const initial = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<ImageGeneration>,
        });
        const refundRule = initial && options.refundOnFailure !== false
            ? await this.billingRuleService.resolveRule(initial.modelId)
            : null;
        const refundAllowed = options.refundOnFailure !== false && refundRule?.refundOnFailure !== false;
        let transitioned = false;
        const failed = await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current || !canFailImageGeneration(current.status)) {
                return current ?? null;
            }
            if (options.requireStaleProcessing && !shouldTimeoutImageGeneration(current)) {
                return current;
            }

            const failureCategory = this.classifyFailure(error);
            const billingStatus = options.billingStatus ??
                (current.billingStatus === ImageGenerationBillingStatus.PENDING
                    ? ImageGenerationBillingStatus.FAILED
                    : current.billingStatus);
            const failureBilling = resolveImageFailureBilling({
                billingStatus,
                billingAmount: Number(current.billingAmount),
                refundAllowed,
            });
            const currentMetadata = this.getImageBillingMetadata(current);
            const updated = await manager.save(ImageGeneration, {
                ...current,
                status: ImageGenerationStatus.FAILED,
                failureCategory,
                errorMessage: options.errorMessage ?? this.publicFailureMessage(failureCategory),
                rawResponse: {
                    ...(current.rawResponse ?? {}),
                    failure: { category: failureCategory },
                    metadata: { ...currentMetadata, refundRequired: failureBilling.refundRequired },
                },
                completedAt: new Date(),
                billingStatus: failureBilling.billingStatus as ImageGenerationBillingStatus,
            });
            transitioned = true;
            return updated;
        });

        if (failed?.status === ImageGenerationStatus.FAILED && transitioned) {
            if (refundAllowed && this.getImageBillingMetadata(failed).refundRequired === true) {
                try {
                    await this.refundGenerationBilling(failed, `Refund for crashed generation ${failed.id}`);
                } catch (refundError) {
                    await this.recordRefundFailure(failed, refundError);
                }
            }
            await this.reclaimStagedResultFiles(failed.id);
            const settled = await this.findById(failed.id);
            await this.notifyTerminalStatus(settled);
            return settled;
        }

        return failed;
    }

    private async recordRefundFailure(record: ImageGeneration, error: unknown): Promise<void> {
        const refundError = error instanceof Error ? error.message : String(error);
        await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id: record.id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current || current.billingStatus === ImageGenerationBillingStatus.REFUNDED) {
                return;
            }
            await manager.update(ImageGeneration, current.id, {
                billingStatus: ImageGenerationBillingStatus.DEDUCTED,
                rawResponse: {
                    ...(current.rawResponse ?? {}),
                    metadata: {
                        ...this.getImageBillingMetadata(current),
                        refundError: "退款记账失败",
                        refundFailedAt: new Date().toISOString(),
                    },
                },
            });
        });
        this.logger.error(`Crash refund failed for generation ${record.id}: ${refundError}`);
    }

    private getImageBillingMetadata(record: Pick<ImageGeneration, "rawResponse">): {
        refundRequired?: boolean;
        refundFailedAt?: string;
    } {
        const metadata = record.rawResponse?.metadata;
        return typeof metadata === "object" && metadata !== null ? metadata as {
            refundRequired?: boolean;
            refundFailedAt?: string;
        } : {};
    }

    private async completeGeneration(
        id: string,
        storedResult: { images: ImageGeneration["resultImages"]; storageFiles: ImageGeneration["storageFiles"] },
        rawRequest: Record<string, unknown>,
        rawResponse: Record<string, unknown>,
        billingRemark: string,
    ): Promise<GenerationCompletionResult> {
        if (!canCompleteImageGeneration(ImageGenerationStatus.PROCESSING, storedResult.images)) {
            throw new Error("图片服务未返回可持久化的有效结果");
        }

        const result = await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current) {
                throw HttpErrorFactory.notFound("生成记录不存在");
            }
            if (!canCompleteImageGeneration(current.status, storedResult.images)) {
                return { record: current, transitioned: false };
            }

            const billed = await this.deductGenerationBilling(current, billingRemark, manager);
            current.billingStatus = billed.billingStatus;
            current.resultImages = storedResult.images;
            current.storageFiles = storedResult.storageFiles;
            current.stagedStorageFiles = [];
            current.rawRequest = this.compactRawPayload(rawRequest);
            current.rawResponse = this.compactRawPayload(rawResponse);
            current.status = ImageGenerationStatus.SUCCEEDED;
            current.progress = 100;
            current.completedAt = new Date();

            return {
                record: await manager.save(ImageGeneration, current),
                transitioned: true,
            };
        });

        return result;
    }

    async getGenerationResultStream(
        generationId: string,
        fileId: string,
        userId: string,
        response: Response,
        consoleAccess?: { isRoot?: BooleanNumberType; permissions?: string[] },
    ): Promise<void> {
        const isConsole = Boolean(consoleAccess);
        const generation = isConsole ? await this.findById(generationId) : await this.findOwnedById(generationId, userId);
        if (isConsole && !this.canReadConsoleMedia(consoleAccess)) {
            throw HttpErrorFactory.forbidden("权限不足");
        }
        const result = generation.resultImages?.find((image) => image.fileId === fileId);
        const storageFile = [...(generation.storageFiles ?? []), ...(generation.stagedStorageFiles ?? [])]
            .find((item) => item.fileId === fileId);
        if (!result || !storageFile || storageFile.generationId !== generation.id || storageFile.userId !== generation.userId || storageFile.extensionId !== EXTENSION_ID) {
            throw HttpErrorFactory.notFound("图片结果不存在");
        }
        const file = await this.fileUploadService.findOneById(fileId);
        if (!file || file.uploaderId !== generation.userId || file.extensionIdentifier !== EXTENSION_ID || file.path !== storageFile.path) {
            throw HttpErrorFactory.notFound("图片结果不存在");
        }
        const stream = this.fileStorageService.createReadStream(file.path, { storageRoot: PRIVATE_STORAGE_ROOT });
        if (!stream) throw HttpErrorFactory.notFound("图片结果不存在");
        response.setHeader("Content-Type", result.mimeType);
        response.setHeader("Content-Disposition", `inline; filename="${this.safeDownloadName(file.originalName, fileId)}"`);
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        stream.pipe(response);
    }

    private canReadConsoleMedia(user?: { isRoot?: BooleanNumberType; permissions?: string[] }): boolean {
        return user?.isRoot === 1 || user?.permissions?.includes(`${EXTENSION_ID}@generation:media-read`) === true;
    }

    private safeDownloadName(originalName: string | undefined, fileId: string): string {
        const candidate = (originalName || `image-${fileId}.png`).replace(/[^a-zA-Z0-9._-]/g, "_");
        return candidate.slice(0, 120) || `image-${fileId}.png`;
    }

    private async stageResultStorageFile(
        generationId: string,
        storageFile: GeneratedStorageFileRecord,
    ): Promise<void> {
        await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current || current.status !== ImageGenerationStatus.PROCESSING) {
                throw HttpErrorFactory.badRequest("生成任务已结束，无法保存图片结果");
            }

            const stagedStorageFiles = current.stagedStorageFiles ?? [];
            if (stagedStorageFiles.some((item) => item.path === storageFile.path)) {
                return;
            }

            current.stagedStorageFiles = [...stagedStorageFiles, storageFile];
            await manager.save(ImageGeneration, current);
        });
    }

    private async assertStagedResultStorageFile(
        generationId: string,
        storagePath: string,
    ): Promise<void> {
        await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (
                !current ||
                current.status !== ImageGenerationStatus.PROCESSING ||
                !(current.stagedStorageFiles ?? []).some((item) => item.path === storagePath)
            ) {
                throw HttpErrorFactory.badRequest("生成任务已结束，无法保存图片结果");
            }
        });
    }

    private async reclaimStagedResultFiles(generationId: string): Promise<void> {
        const storageFiles = await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current || current.status !== ImageGenerationStatus.FAILED) {
                return [];
            }
            return (current.stagedStorageFiles ?? []).filter((item) =>
                this.isStagedResultStoragePath(generationId, item.path),
            );
        });
        const cleaned = await this.cleanupStoredResultFiles(storageFiles);
        if (cleaned && storageFiles.length > 0) {
            await this.withTransaction(async (manager) => {
                await manager.query(LOCK_TIMEOUT);
                const current = await manager.findOne(ImageGeneration, {
                    where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                    lock: { mode: "pessimistic_write" },
                });
                if (!current || current.status !== ImageGenerationStatus.FAILED) {
                    return;
                }
                const paths = new Set(storageFiles.map((item) => item.path));
                current.stagedStorageFiles = (current.stagedStorageFiles ?? []).filter(
                    (item) => !paths.has(item.path),
                );
                await manager.save(ImageGeneration, current);
            });
        }
    }

    private async reclaimUncommittedResultFiles(
        generationId: string,
        storageFiles: ImageGeneration["storageFiles"],
    ): Promise<void> {
        const referencedPaths = await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(ImageGeneration, {
                where: { id: generationId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            return new Set((current?.storageFiles ?? []).map((item) => item.path));
        });
        await this.cleanupStoredResultFiles(
            storageFiles.filter((storageFile) => !referencedPaths.has(storageFile.path)),
        );
    }

    private async reclaimGenerationFiles(generation: ImageGeneration): Promise<void> {
        const storageFiles = [
            ...(generation.storageFiles ?? []),
            ...(generation.stagedStorageFiles ?? []),
        ];
        const cleaned = await this.cleanupStoredResultFiles(storageFiles);
        if (!cleaned) {
            throw HttpErrorFactory.internal("图片结果文件回收失败，请稍后重试删除");
        }
    }

    private async cleanupStoredResultFiles(
        storageFiles: ImageGeneration["storageFiles"],
    ): Promise<boolean> {
        let cleaned = true;
        for (const storageFile of storageFiles) {
            if (!storageFile.path || !this.isGeneratedResultStoragePath(storageFile.generationId, storageFile)) {
                cleaned = false;
                this.logger.error("Refusing to reclaim an untracked image result file");
                continue;
            }
            try {
                await this.fileStorageService.deleteFile(storageFile.path, {
                    storageRoot: PRIVATE_STORAGE_ROOT,
                });
            } catch {
                cleaned = false;
                this.logger.error(`Failed to reclaim image result file ${storageFile.path}`);
                continue;
            }
            try {
                if (storageFile.fileId && storageFile.fileId !== "pending") {
                    await this.deleteGeneratedFileRecord(storageFile);
                }
            } catch {
                cleaned = false;
                this.logger.error(`Failed to reclaim image result file ${storageFile.path}`);
            }
        }
        return cleaned;
    }

    private async deleteGeneratedFileRecord(storageFile: GeneratedStorageFileRecord): Promise<void> {
        const file = await this.fileUploadService.findOneById(storageFile.fileId);
        if (!file) return;
        if (file.uploaderId !== storageFile.userId || file.extensionIdentifier !== EXTENSION_ID || file.path !== storageFile.path) {
            throw HttpErrorFactory.notFound("图片结果文件不存在");
        }
        await this.fileUploadService.delete(storageFile.fileId);
    }

    private isGeneratedResultStoragePath(
        generationId: string,
        storageFile: Pick<GeneratedStorageFileRecord, "path" | "generationId" | "userId" | "extensionId">,
    ): boolean {
        return storageFile.generationId === generationId &&
            typeof storageFile.userId === "string" &&
            storageFile.userId.length > 0 &&
            storageFile.extensionId === EXTENSION_ID &&
            this.isStagedResultStoragePath(generationId, storageFile.path);
    }

    private isStagedResultStoragePath(generationId: string, storagePath: string): boolean {
        const escapedGenerationId = generationId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(
            `^generated/\\d{4}/\\d{2}/${escapedGenerationId}-[1-9]\\d*\\.(png|jpg|webp)$`,
        ).test(storagePath);
    }

    private async notifyTerminalStatus(record: ImageGeneration) {
        if (![ImageGenerationStatus.SUCCEEDED, ImageGenerationStatus.FAILED].includes(record.status)) {
            return;
        }
        const succeeded = record.status === ImageGenerationStatus.SUCCEEDED;
        try {
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
                    reason: record.status === ImageGenerationStatus.FAILED
                        ? this.publicFailureMessage(record.failureCategory)
                        : undefined,
                    billingStatus: record.billingStatus,
                    completedAt: record.completedAt?.toISOString(),
                },
            });
        } catch {
            this.logger.warn(`Notify image generation ${record.id} ${record.status} failed`);
        }
    }

    async list(query: QueryGenerationDto, userId: string) {
        const where = buildDefinedWhere<FindOptionsWhere<ImageGeneration>>({
            userId,
            prompt: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            status: query.status,
            modelId: query.modelId,
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
        const page = await this.paginate(query, {
            where: buildDefinedWhere<FindOptionsWhere<ImageGeneration>>({
                prompt: query.keyword ? Like(`%${query.keyword}%`) : undefined,
                status: query.status,
                modelId: query.modelId,
                mode: query.mode,
            }),
            order: { createdAt: "DESC" },
        });
        return {
            ...page,
            items: page.items.map((item) => this.toConsoleGeneration(item)),
        };
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

    async findConsoleById(id: string) {
        return this.toConsoleGeneration(await this.findById(id));
    }

    async deleteOwnedById(id: string, userId: string) {
        const generation = await this.findOwnedById(id, userId);
        this.assertGenerationCanBeDeleted(generation);
        await this.reclaimGenerationFiles(generation);
        await this.softDeleteGenerationWithReservationRelease(id, userId);
        return { success: true, message: "删除成功" };
    }

    async deleteById(id: string) {
        const generation = await this.findById(id);
        this.assertGenerationCanBeDeleted(generation);
        await this.reclaimGenerationFiles(generation);
        await this.softDeleteGenerationWithReservationRelease(id, generation.userId);
        return { success: true, message: "删除成功" };
    }

    private async softDeleteGenerationWithReservationRelease(id: string, userId: string): Promise<void> {
        await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: "pessimistic_write" },
            });
            if (!user) throw HttpErrorFactory.notFound("用户不存在");
            const generation = await manager.findOne(ImageGeneration, {
                where: { id, userId } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!generation) throw HttpErrorFactory.notFound("生成记录不存在");
            this.assertGenerationCanBeDeleted(generation);
            await manager.softRemove(ImageGeneration, generation);
        });
    }

    async retry(id: string, userId: string) {
        const source = await this.findOwnedById(id, userId);
        return this.retryFromSource(source, userId, false);
    }

    async retryForWeb(id: string, userId: string) {
        return this.toPublicGeneration(await this.retry(id, userId));
    }

    async retryAsOwner(id: string) {
        const source = await this.findById(id);
        return this.retryFromSource(source, source.userId, true);
    }

    async retryForConsole(id: string) {
        return this.toConsoleGeneration(await this.retryAsOwner(id));
    }

    private async retryFromSource(source: ImageGeneration, userId: string, includeHidden = false) {
        if (!canRetryImageGeneration(source.status, source.billingStatus)) {
            throw HttpErrorFactory.badRequest("生成任务的退款尚未完成，暂不能重试");
        }

        await this.modelConfigService.findEnabledById(source.modelId, includeHidden);
        const hasReferenceImage = Boolean(
            source.sourceImages?.length || source.referenceImageUrl || source.referenceImageFileId,
        );
        const retryKey = deriveImageRetryRequestKey(source.id);
        const retryPayload = buildImageRetryPayload(
            {
                ...source,
                maskImageUrl: source.maskImage?.url,
                maskImageFileId: source.maskImage?.fileId,
                mode: hasReferenceImage ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE,
            },
            retryKey,
        );

        return this.createAndGenerate(retryPayload as unknown as CreateGenerationDto, userId);
    }

    private toPublicGeneration(record: ImageGeneration) {
        return {
            id: record.id,
            mode: record.mode,
            status: record.status,
            billingStatus: record.billingStatus,
            requestKey: record.requestKey,
            prompt: record.prompt,
            negativePrompt: record.negativePrompt,
            referenceImageUrl: record.referenceImageUrl,
            referenceImageFileId: record.referenceImageFileId,
            sourceImages: record.sourceImages,
            maskImage: record.maskImage,
            modelId: record.modelId,
            modelName: record.modelName,
            size: record.size,
            n: record.n,
            quality: record.quality,
            style: record.style,
            responseFormat: record.responseFormat,
            resultImages: (record.resultImages ?? []).flatMap((image) =>
                image.fileId && image.mimeType && Number.isFinite(image.size)
                    ? [{
                        fileId: image.fileId,
                        mimeType: image.mimeType,
                        size: image.size,
                        revisedPrompt: image.revisedPrompt,
                    }]
                    : [],
            ),
            errorMessage: record.errorMessage,
            billingAmount: record.billingAmount,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private toConsoleGeneration(record: ImageGeneration) {
        return {
            ...this.toPublicGeneration(record),
            userId: record.userId,
            provider: record.provider,
        };
    }

    async listImageModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    private assertGenerationCanBeDeleted(generation: ImageGeneration) {
        if ([ImageGenerationStatus.PENDING, ImageGenerationStatus.PROCESSING].includes(generation.status)) {
            throw HttpErrorFactory.badRequest("生成任务处理中，完成或失败后才能删除");
        }
        if (
            generation.status === ImageGenerationStatus.FAILED &&
            generation.billingStatus === ImageGenerationBillingStatus.DEDUCTED
        ) {
            throw HttpErrorFactory.badRequest("生成任务退款尚未完成，暂不能删除");
        }
    }

    async enhancePrompt(dto: PromptEnhanceDto) {
        if (!dto.modelId) {
            throw HttpErrorFactory.badRequest("请选择绘画模型后再润色提示词");
        }
        const modelConfig = await this.modelConfigService.findEnabledById(dto.modelId);
        const promptEnhancerModelId = modelConfig.promptEnhancerModelId;
        if (!promptEnhancerModelId) {
            throw HttpErrorFactory.badRequest("提示词润色模型未配置，请联系管理员");
        }
        await this.modelConfigService.assertPromptEnhancerModelUsable(promptEnhancerModelId);
        const result = await this.aiModelService.generateText(promptEnhancerModelId, {
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
            prompt: this.normalizeOptimizedPrompt(result.text),
            source: "ai",
        };
    }

    private async getUserPolicyUsage(userId: string) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const todayCount = await this.generationRepository.count({
            where: {
                userId,
                createdAt: Between(startOfDay, endOfDay),
            } as FindOptionsWhere<ImageGeneration>,
        });

        return { todayCount };
    }

    private async deductGenerationBilling(record: ImageGeneration, remark: string, transactionManager?: EntityManager) {
        const deduct = async (manager: EntityManager) => {
            await manager.query(LOCK_TIMEOUT);
            const locked = await manager.findOne(ImageGeneration, {
                where: { id: record.id } as FindOptionsWhere<ImageGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) {
                throw HttpErrorFactory.notFound("生成记录不存在");
            }
            if (locked.status !== ImageGenerationStatus.PROCESSING) {
                return locked;
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
            if (shouldDeductImageGeneration({
                billingStatus: locked.billingStatus,
                hasDeductionLog: duplicateDeduction,
            })) {
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
        };

        if (transactionManager) {
            return deduct(transactionManager);
        }
        return this.withTransaction(deduct);
    }

    private async refundGenerationBilling(
        record: ImageGeneration,
        remark: string,
        transactionManager?: EntityManager,
    ) {
        const refund = async (manager: EntityManager) => {
            await manager.query(LOCK_TIMEOUT);
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

            const hasRefundLog = await this.hasGenerationBillingLog(locked.id, ACTION.INC, manager);
            if (!shouldRefundImageGeneration({
                billingStatus: locked.billingStatus,
                hasDeductionLog: true,
                hasRefundLog,
            })) {
                if (locked.billingStatus !== ImageGenerationBillingStatus.REFUNDED && hasRefundLog) {
                    locked.billingStatus = ImageGenerationBillingStatus.REFUNDED;
                    await manager.save(ImageGeneration, locked);
                    record.billingStatus = locked.billingStatus;
                }
                return;
            }

            if (locked.billingStatus === ImageGenerationBillingStatus.REFUNDED || hasRefundLog) {
                locked.billingStatus = ImageGenerationBillingStatus.REFUNDED;
                await manager.save(ImageGeneration, locked);
                record.billingStatus = locked.billingStatus;
                return;
            }

            const amount = normalizePowerAmount(Number(locked.billingAmount));
            await this.billingService.addUserPower({
                userId: locked.userId,
                amount,
                remark,
                associationNo: locked.id,
                associationUserId: locked.userId,
            }, manager);

            locked.billingStatus = ImageGenerationBillingStatus.REFUNDED;
            await manager.save(ImageGeneration, locked);
            record.billingStatus = locked.billingStatus;
        };

        if (transactionManager) {
            await refund(transactionManager);
            return;
        }
        await this.withTransaction(refund);
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
        maxReferenceImageSizeMb: number,
    ) {
        if (record.sourceImages?.length || record.referenceImageUrl || record.referenceImageFileId || record.maskImage) {
            throw HttpErrorFactory.badRequest("当前 SDK 图片生成链路暂不支持参考图或局部重绘");
        }

        this.logger.log(
            `Generating image with SDK: model=${modelConfig.model} size=${record.size} n=${record.n}`,
        );

        const result = await this.aiModelService.generateImage(modelConfig.mainModelId, {
            prompt: record.prompt,
            n: record.n,
            size: record.size as `${number}x${number}`,
            providerOptions: {
                openai: {
                    quality: record.quality,
                    style: record.style,
                    output_format: record.outputFormat,
                },
            },
        });

        return {
            images: result.images.map((image) => {
                const mimeType = image.mediaType ?? this.mimeTypeForOutputFormat(record.outputFormat);
                if (image.base64) {
                    this.assertGeneratedBase64Length(image.base64);
                    return { b64Json: image.base64, mimeType };
                }
                if (image.uint8Array.byteLength > MAX_GENERATED_IMAGE_BYTES) {
                    throw HttpErrorFactory.badRequest("生成图片结果超过大小限制");
                }
                return {
                    b64Json: Buffer.from(image.uint8Array).toString("base64"),
                    mimeType,
                };
            }).filter((image) => image.b64Json),
            rawRequest: {
                model: modelConfig.model,
                prompt: record.prompt,
                n: record.n,
                size: record.size,
                quality: record.quality,
                style: record.style,
                outputFormat: record.outputFormat,
            },
            rawResponse: {
                imageCount: result.images.length,
                apiMode: "ai-sdk-image",
            },
        };
    }

    private buildProviderPrompt(record: ImageGeneration): string {
        return record.prompt;
    }

    private normalizeOptimizedPrompt(value: string): string {
        const prompt = this.sanitizeText(value.trim().replace(/^["'`]+|["'`]+$/g, ""), 4000);
        if (!prompt) {
            throw HttpErrorFactory.badRequest("提示词润色模型未返回有效结果");
        }
        return prompt;
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
    ): asserts file is { uploaderId?: string; extensionIdentifier?: string; mimeType?: string; originalName?: string; size: number } {
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

    private async normalizeGenerationRequest(
        dto: CreateGenerationDto,
        modelConfig: Pick<ImageModelConfig, "capabilities" | "defaultParams">,
        userId: string,
    ) {
        const sourceImages = await this.normalizeSourceImages(dto, userId);
        const primarySourceImage = sourceImages[0];
        const referenceImageUrl = primarySourceImage?.url;
        const maskImageUrl = await this.normalizeReferenceImageUrl(dto.maskImageUrl, Boolean(dto.maskImageFileId));
        if (dto.maskImageFileId) {
            await this.assertUploadFileUsable(dto.maskImageFileId, userId, "遮罩图");
        }
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

    private getRequestedReservedCapabilities(dto: CreateGenerationDto) {
        const hasSourceImage = (dto.sourceImages ?? []).some((source) => Boolean(source?.url?.trim() || source?.fileId));
        return {
            hasReferenceImage: dto.mode === ImageGenerationMode.IMAGE_TO_IMAGE || Boolean(dto.referenceImageUrl?.trim() || dto.referenceImageFileId || hasSourceImage),
            hasMaskImage: Boolean(dto.maskImageUrl?.trim() || dto.maskImageFileId),
        };
    }

    private assertRuntimeGenerationSupported(request: { hasReferenceImage: boolean; hasMaskImage: boolean }) {
        if (request.hasMaskImage) {
            throw HttpErrorFactory.badRequest("当前图片生成链路暂不支持局部重绘，请先使用文生图；局部重绘将在后续版本开放");
        }
        if (request.hasReferenceImage) {
            throw HttpErrorFactory.badRequest("当前图片生成链路暂不支持参考图生成，请先使用文生图；参考图能力将在后续版本开放");
        }
    }

    private validateAllowedParams(
        dto: CreateGenerationDto,
        modelConfig: Pick<ImageModelConfig, "allowedParams" | "capabilities" | "defaultParams">,
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

    private publicFailureMessage(category?: string): string {
        if (category === "rate_limit") return "图片服务当前繁忙，请稍后重试；如已扣费将按账务结果处理。";
        if (category === "timeout") return "图片服务响应超时，请稍后重试；如已扣费将按账务结果处理。";
        if (category === "content_policy") return "提示词或图片内容未通过服务商安全策略，请调整后重试。";
        return "图片服务暂不可用，请稍后重试；如已扣费将按账务结果处理。";
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
        const generation = await this.findById(generationId);
        let storageFiles: GeneratedStorageFileRecord[] = [];
        const storedImages: Array<{ fileId: string; mimeType: string; size: number; revisedPrompt?: string }> = [];
        let batchBytes = 0;

        try {
            for (const [index, img] of images.entries()) {
                const mimeType = this.normalizeGeneratedImageMimeType(img.mimeType);
                const extension = this.extensionForMimeType(mimeType);
                const now = new Date();
                const year = String(now.getFullYear());
                const month = String(now.getMonth() + 1).padStart(2, "0");
                const relativePath = path.posix.join(
                    GENERATED_RESULT_DIRECTORY,
                    year,
                    month,
                    `${generationId}-${index + 1}.${extension}`,
                );
                const buffer = img.url
                    ? await this.downloadAndValidateResultImage(img.url, mimeType)
                    : img.b64Json
                        ? this.decodeGeneratedImage(img.b64Json, mimeType)
                        : undefined;
                if (!buffer) continue;

                batchBytes += buffer.byteLength;
                if (batchBytes > MAX_GENERATED_BATCH_BYTES) {
                    throw HttpErrorFactory.badRequest("生成图片结果超过批次大小限制");
                }

                const { file, storageFile } = await this.stageGeneratedResultStorageFile(
                    generation,
                    relativePath,
                    mimeType,
                    buffer.byteLength,
                );
                storageFiles = [...storageFiles, storageFile];
                await this.fileStorageService.saveBuffer(
                    buffer,
                    {
                        path: path.posix.dirname(relativePath),
                        fileName: path.posix.basename(relativePath),
                        fullPath: relativePath,
                    },
                    { storageRoot: PRIVATE_STORAGE_ROOT },
                );
                await this.assertStagedResultStorageFile(generationId, relativePath);
                storedImages.push({
                    fileId: file.id,
                    mimeType,
                    size: buffer.byteLength,
                    revisedPrompt: img.revisedPrompt,
                });
            }
        } catch (error) {
            await this.cleanupStoredResultFiles(storageFiles);
            throw error;
        }

        return { images: storedImages, storageFiles };
    }

    private async stageGeneratedResultStorageFile(
        generation: ImageGeneration,
        relativePath: string,
        mimeType: string,
        size: number,
    ): Promise<{ file: File; storageFile: GeneratedStorageFileRecord }> {
        const storageFile: GeneratedStorageFileRecord = {
            fileId: randomUUID(),
            generationId: generation.id,
            userId: generation.userId,
            extensionId: EXTENSION_ID,
            path: relativePath,
            mimeType,
            size,
        };
        await this.stageResultStorageFile(generation.id, storageFile);
        const file = await this.registerGeneratedFile(generation, storageFile);
        return { file, storageFile };
    }

    private async registerGeneratedFile(
        generation: ImageGeneration,
        storageFile: GeneratedStorageFileRecord,
    ): Promise<File> {
        return this.fileUploadService.create({
            id: storageFile.fileId,
            url: "",
            originalName: path.posix.basename(storageFile.path),
            storageName: path.posix.basename(storageFile.path),
            type: FileType.IMAGE,
            mimeType: storageFile.mimeType,
            size: storageFile.size,
            extension: this.extensionForMimeType(storageFile.mimeType),
            path: storageFile.path,
            description: `echoflow-image generation ${generation.id}`,
            uploaderId: generation.userId,
            extensionIdentifier: EXTENSION_ID,
        });
    }

    private async downloadAndValidateResultImage(rawUrl: string, mimeType: string): Promise<Buffer> {
        const safeUrl = await this.normalizeResultImageUrl(rawUrl);
        const response = await downloadPublicHttpUrl(safeUrl, {
            label: "图片结果",
            urlLabel: "图片结果 URL",
            timeoutMs: 30_000,
            maxBytes: MAX_GENERATED_IMAGE_BYTES,
            maxRedirects: 3,
        });
        if (!response.ok) {
            throw HttpErrorFactory.badRequest("图片服务返回了无效图片");
        }
        const declaredLength = Number(response.headers["content-length"]);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_GENERATED_IMAGE_BYTES) {
            throw HttpErrorFactory.badRequest("生成图片结果超过大小限制");
        }
        const contentType = response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
        if (!contentType || contentType !== mimeType) {
            throw HttpErrorFactory.badRequest("生成图片结果 MIME 类型无效");
        }
        this.assertGeneratedImageSignature(response.buffer, mimeType);
        return response.buffer;
    }

    private toArrayBuffer(buffer: Buffer): ArrayBuffer {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }

    private async normalizeResultImageUrl(raw: string): Promise<string> {
        try {
            return await assertPublicHttpUrl(raw, { label: "图片结果 URL" });
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

    private async normalizeSourceImages(dto: CreateGenerationDto, userId: string): Promise<ImageSourceRecord[]> {
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
            if (fileId) {
                await this.assertUploadFileUsable(fileId, userId, `参考图 ${normalized.length + 1}`);
            }
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

    private async assertUploadFileUsable(fileId: string, userId: string, label: string) {
        const file = await this.fileUploadService.findOneById(fileId);
        this.assertPluginUploadOwnedByUser(file, userId, label);
        this.normalizeReferenceImageMimeType(file.mimeType, file.originalName);
    }

    private async assertUploadFilesWithinLimit(
        sources: Array<{ fileId?: string; label: string } | undefined>,
        userId: string,
        maxReferenceImageSizeMb: number,
    ) {
        const seen = new Set<string>();
        const maxBytes = maxReferenceImageSizeMb * 1024 * 1024;

        for (const source of sources) {
            if (!source?.fileId || seen.has(source.fileId)) continue;
            seen.add(source.fileId);
            const file = await this.fileUploadService.findOneById(source.fileId);
            this.assertPluginUploadOwnedByUser(file, userId, source.label);
            if (Number(file?.size ?? 0) > maxBytes) {
                throw HttpErrorFactory.badRequest(`${source.label}不能超过 ${maxReferenceImageSizeMb}MB`);
            }
        }
    }

    private normalizeGeneratedImageMimeType(raw?: string): string {
        const mimeType = raw?.split(";")[0]?.toLowerCase();
        if (mimeType && ["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
            return mimeType;
        }
        return "image/png";
    }

    private mimeTypeForOutputFormat(format?: string): string {
        if (format === "jpeg") return "image/jpeg";
        if (format === "webp") return "image/webp";
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

    private decodeGeneratedImage(value: string, mimeType: string): Buffer {
        const rawEncoded = this.stripBase64DataUrl(value);
        this.assertGeneratedBase64Length(rawEncoded);
        const encoded = rawEncoded.replace(/\s/g, "");
        if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
            throw HttpErrorFactory.badRequest("生成图片结果格式无效");
        }
        const buffer = Buffer.from(encoded, "base64");
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_GENERATED_IMAGE_BYTES) {
            throw HttpErrorFactory.badRequest("生成图片结果超过大小限制");
        }
        this.assertGeneratedImageSignature(buffer, mimeType);
        return buffer;
    }

    private assertGeneratedBase64Length(value: string): void {
        const dataUrlPrefixLength = value.match(/^data:image\/[a-z0-9.+-]+;base64,/i)?.[0].length ?? 0;
        const encodedLength = value.length - dataUrlPrefixLength;
        if (encodedLength > MAX_GENERATED_BASE64_INPUT_LENGTH) {
            throw HttpErrorFactory.badRequest("生成图片结果超过大小限制");
        }
    }

    private assertGeneratedImageSignature(buffer: Buffer, mimeType: string): void {
        const isPng = mimeType === "image/png" && buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        const isJpeg = mimeType === "image/jpeg" && buffer.subarray(0, 3).equals(
            Buffer.from([0xff, 0xd8, 0xff]),
        );
        const isWebp = mimeType === "image/webp" &&
            buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
            buffer.subarray(8, 12).toString("ascii") === "WEBP";
        if (!isPng && !isJpeg && !isWebp) {
            throw HttpErrorFactory.badRequest("生成图片结果格式无效");
        }
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
