import path from "node:path";

import { BaseService } from "@buildingai/base";
import { ACTION } from "@buildingai/constants/shared/account-log.constants";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    normalizePublicHttpUrl,
    PublicAiModelService,
    safeJsonParse,
} from "@buildingai/extension-sdk";
import { FileStorageService, FileUploadService } from "@buildingai/core/modules";
import { User } from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { EntityManager, FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { Cron } from "@buildingai/core/@nestjs/schedule";

import {
    VideoGeneration,
    VideoGenerationBillingStatus,
    VideoGenerationStatus,
} from "../../../db/entities/video-generation.entity";
import { VideoBillingRule } from "../../../db/entities/video-billing-rule.entity";
import { VideoConfigAudit } from "../../../db/entities/video-config-audit.entity";
import { VideoModelConfig } from "../../../db/entities/video-model-config.entity";
import { VideoPolicyConfig } from "../../../db/entities/video-policy-config.entity";
import { VideoPromptOptimization } from "../../../db/entities/video-prompt-optimization.entity";
import { VideoPromptTemplate } from "../../../db/entities/video-prompt-template.entity";
import { VideoProviderConfig } from "../../../db/entities/video-provider-config.entity";
import type { VideoMediaItem } from "../../../db/entities/video-generation.entity";
import { CreateVideoGenerationDto, QueryVideoGenerationDto } from "../dto";
import { BillingRuleService } from "./billing-rule.service";
import { ModelConfigService, type ResolvedVideoModelConfig } from "./model-config.service";
import { PolicyService } from "./policy.service";
import { PromptOptimizationService } from "./prompt-optimization.service";
import { ProviderConfigService } from "./provider-config.service";
import { TemplateService } from "./template.service";
import { VIDEO_GENERATION_JOB, VIDEO_GENERATION_QUEUE } from "./generation-queue.constants";
import {
    canCompleteVideoGeneration,
    canFailVideoGeneration,
    canRetryVideoGeneration,
    getResumedVideoProgress,
    shouldResumeVideoGeneration,
    shouldTimeoutVideoGeneration,
} from "./video-generation-recovery-rules";

const LOCK_TIMEOUT = 'SET LOCAL lock_timeout = 3000';
const MAX_GENERATED_VIDEO_BYTES = 200 * 1024 * 1024;

const EXTENSION_ID = "echoflow-video";

@Injectable()
export class GenerationService extends BaseService<VideoGeneration> implements OnModuleInit {
    protected readonly logger = new Logger(GenerationService.name);

    constructor(
        @InjectRepository(VideoGeneration)
        private readonly generationRepository: Repository<VideoGeneration>,
        private readonly fileUploadService: FileUploadService,
        private readonly fileStorageService: FileStorageService,
        private readonly billingService: ExtensionBillingService,
        private readonly aiModelService: PublicAiModelService,
        private readonly modelConfigService: ModelConfigService,
        private readonly billingRuleService: BillingRuleService,
        private readonly policyService: PolicyService,
        private readonly notificationService: ExtensionNotificationService,
        @InjectQueue(VIDEO_GENERATION_QUEUE)
        private readonly generationQueue: Queue,
    ) {
        super(generationRepository);
    }

    private scanningStale = false;

    async onModuleInit() {
        await this.notificationService.registerScenes(EXTENSION_ID, [
            {
                sceneCode: `${EXTENSION_ID}.generation.succeeded`,
                name: "视频生成完成",
                description: "用户发起的视频生成任务处理成功。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "视频生成完成",
                contentTemplate: "{{taskName}} 已处理完成，可前往查看结果。",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
            {
                sceneCode: `${EXTENSION_ID}.generation.failed`,
                name: "视频生成失败",
                description: "用户发起的视频生成任务处理失败。",
                level: "error",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "视频生成失败",
                contentTemplate: "{{taskName}} 处理失败，{{reason}}",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
        ]);
        await this.scanStaleProcessing();
    }

    @Cron("*/5 * * * *")
    async scheduledStaleScan() {
        await this.scanStaleProcessing();
    }

    /** Return admin-enabled model options for web/console selectors. */
    async listModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    async createAndSubmitForWeb(dto: CreateVideoGenerationDto, userId: string) {
        return this.toPublicGeneration(await this.createAndSubmit(dto, userId));
    }

    /** Create a pending video generation and enqueue its worker job. */
    async createAndSubmit(dto: CreateVideoGenerationDto, userId: string) {
        if (dto.requestKey) {
            const existing = await this.generationRepository.findOne({
                where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<VideoGeneration>,
            });
            if (existing) return existing;
        }

        const modelConfig = await this.modelConfigService.findEnabledById(dto.modelConfigId);
        const prompt = this.sanitizeText(dto.prompt, 4000);
        const requestedMedia = dto.media ?? [];
        if (requestedMedia.length > 5) {
            throw HttpErrorFactory.badRequest("单次最多提交 5 个媒体素材");
        }
        const policy = await this.policyService.validateGeneration(userId, modelConfig.id, dto);
        const media = await this.normalizeAndValidateMedia(requestedMedia, userId);
        const normalizedDto = { ...dto, media };
        this.validateMediaForModelConfig(modelConfig, media);
        this.validateParamsForModelConfig(modelConfig, normalizedDto);
        const generationParams = {
            resolution: dto.resolution ?? modelConfig.defaultParams.resolution,
            duration: dto.duration ?? modelConfig.defaultParams.duration,
            ratio: dto.ratio ?? modelConfig.defaultParams.ratio,
            watermark: dto.watermark ?? modelConfig.defaultParams.watermark,
        };
        const billingAmount = await this.billingRuleService.calculateAmount({
            modelConfigId: modelConfig.id,
            model: modelConfig.model,
            duration: generationParams.duration,
            resolution: generationParams.resolution,
        });
        const billingRule = await this.billingRuleService.resolveRule(modelConfig.id, modelConfig.model);
        if (!(await this.billingService.hasSufficientPower(userId, billingAmount))) {
            throw HttpErrorFactory.badRequest("可用算力不足，请充值后重试");
        }

        const record = this.generationRepository.create({
            userId,
            requestKey: dto.requestKey,
            model: modelConfig.model,
            modelConfigId: modelConfig.id,
            provider: modelConfig.provider,
            modelName: modelConfig.displayName,
            status: VideoGenerationStatus.PENDING,
            billingStatus: VideoGenerationBillingStatus.PENDING,
            prompt,
            originalPrompt: dto.originalPrompt ? this.sanitizeText(dto.originalPrompt, 4000) : undefined,
            promptOptimizationSource: dto.promptOptimizationSource,
            promptOptimizationStyle: dto.promptOptimizationStyle,
            promptOptimizerModelId: dto.promptOptimizerModelId,
            media,
            parameters: generationParams,
            billingAmount,
            billingRuleSnapshot: this.compactRawPayload({
                id: billingRule.id,
                modelConfigId: billingRule.modelConfigId,
                baseCost: billingRule.baseCost,
                perSecondCost: billingRule.perSecondCost,
                resolutionMultipliers: billingRule.resolutionMultipliers,
                minimumCost: billingRule.minimumCost,
                refundOnFailure: billingRule.refundOnFailure,
            }),
            progress: 0,
            statusEvents: [this.makeStatusEvent(VideoGenerationStatus.PENDING, "任务已创建，等待队列处理", "web")],
        });

        let saved: VideoGeneration;
        try {
            saved = await this.withTransaction(async (manager) => {
                await manager.query(LOCK_TIMEOUT);
                const user = await manager.findOne(User, {
                    where: { id: userId },
                    lock: { mode: "pessimistic_write" },
                });
                if (!user) throw HttpErrorFactory.notFound("用户不存在");
                if (dto.requestKey) {
                    const existing = await manager.findOne(VideoGeneration, {
                        where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<VideoGeneration>,
                    });
                    if (existing) return existing;
                }
                const activeCount = await manager.count(VideoGeneration, {
                    where: { userId, status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]) } as FindOptionsWhere<VideoGeneration>,
                });
                if (activeCount >= policy.maxConcurrentJobsPerUser) {
                    throw HttpErrorFactory.badRequest(`当前已有 ${activeCount} 个视频任务处理中，请稍后再试`);
                }
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayCount = await manager.count(VideoGeneration, {
                    where: { userId, createdAt: MoreThanOrEqual(todayStart) } as FindOptionsWhere<VideoGeneration>,
                });
                if (todayCount >= policy.dailyJobsPerUser) {
                    throw HttpErrorFactory.badRequest("今日视频生成次数已达上限");
                }
                return manager.save(VideoGeneration, record);
            });
        } catch (error) {
            if (dto.requestKey && this.isUniqueConstraintError(error)) {
                const existing = await this.generationRepository.findOne({
                    where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<VideoGeneration>,
                });
                if (existing) return existing;
            }
            throw error;
        }

        await this.enqueueGenerationJob(saved.id);
        return saved;
    }

    async executeGenerationJob(id: string) {
        const saved = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<VideoGeneration>,
        });
        if (!saved) throw HttpErrorFactory.notFound("视频生成记录不存在");
        if (saved.status !== VideoGenerationStatus.PENDING) return saved;

        const claimed = await this.generationRepository.update(
            { id, status: VideoGenerationStatus.PENDING } as FindOptionsWhere<VideoGeneration>,
            {
                status: VideoGenerationStatus.PROCESSING,
                startedAt: new Date(),
                progress: Math.max(saved.progress ?? 0, 5),
            },
        );
        if (!claimed.affected) return this.findGenerationById(id);

        if (!saved.modelConfigId) {
            throw HttpErrorFactory.badRequest("视频任务缺少模型配置，无法执行");
        }
        const modelConfig = await this.modelConfigService.findEnabledById(saved.modelConfigId);
        let deducted: VideoGeneration;
        try {
            deducted = await this.deductGenerationBilling(saved, modelConfig.model);
        } catch (error) {
            await this.markGenerationCrashed(id, error, {
                errorMessage: "算力扣费失败，请稍后重试",
                billingStatus: VideoGenerationBillingStatus.FAILED,
                refundOnFailure: false,
            });
            return this.findGenerationById(id);
        }
        if (deducted.status !== VideoGenerationStatus.PROCESSING) return deducted;

        let stored: { path: string; url: string } | undefined;
        let completed: VideoGeneration;
        try {
            await this.generationRepository.update(
                { id, status: VideoGenerationStatus.PROCESSING } as FindOptionsWhere<VideoGeneration>,
                { progress: 20 },
            );
            const result = await this.generateWithProvider(deducted, modelConfig);
            stored = await this.storeResultVideo(id, result.video);
            completed = await this.completeGeneration(id, stored.url, result.rawRequest, result.rawResponse);
            if (completed.status !== VideoGenerationStatus.SUCCEEDED) {
                await this.deleteStoredResultVideo(stored.path);
            }
        } catch (error) {
            if (stored) await this.deleteStoredResultVideo(stored.path);
            const failed = await this.markGenerationCrashed(id, error);
            if (failed) return failed;
            throw error;
        }
        if (completed.status === VideoGenerationStatus.SUCCEEDED) {
            await this.notifyTerminalStatus(completed);
        }
        return completed;
    }

    private async enqueueGenerationJob(id: string) {
        try {
            await this.generationQueue.add(
                VIDEO_GENERATION_JOB,
                { id },
                {
                    jobId: `video-generation-${id}`,
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        } catch (error) {
            this.logger.error(`Queue video generation ${id} failed`, error);
            await this.markGenerationCrashed(id, new Error("视频生成队列暂不可用，请稍后重试"), {
                refundOnFailure: false,
            });
            throw HttpErrorFactory.badRequest("视频生成队列暂不可用，请稍后重试");
        }
    }

    private async deductGenerationBilling(record: VideoGeneration, model: string) {
        return this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const locked = await manager.findOne(VideoGeneration, {
                where: { id: record.id } as FindOptionsWhere<VideoGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) throw HttpErrorFactory.notFound("视频生成记录不存在");
            if (locked.status !== VideoGenerationStatus.PROCESSING) return locked;
            if (!(await this.hasBillingLog(locked.id, ACTION.DEC, manager))) {
                await this.billingService.deductUserPower({
                    userId: locked.userId,
                    amount: locked.billingAmount,
                    remark: `Echoflow Video: ${model}`,
                    associationNo: locked.id,
                    associationUserId: locked.userId,
                }, manager);
            }
            locked.billingStatus = VideoGenerationBillingStatus.DEDUCTED;
            return manager.save(VideoGeneration, locked);
        });
    }

    private async completeGeneration(
        id: string,
        videoUrl: string,
        rawRequest: Record<string, unknown>,
        rawResponse: Record<string, unknown>,
    ) {
        return this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(VideoGeneration, {
                where: { id } as FindOptionsWhere<VideoGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current) throw HttpErrorFactory.notFound("视频生成记录不存在");
            if (!canCompleteVideoGeneration(current.status, videoUrl)) return current;
            current.status = VideoGenerationStatus.SUCCEEDED;
            current.videoUrl = videoUrl;
            current.rawRequest = this.compactRawPayload(rawRequest);
            current.rawResponse = this.compactRawPayload(rawResponse);
            current.progress = 100;
            current.completedAt = new Date();
            this.appendStatusEvent(current, VideoGenerationStatus.SUCCEEDED, "视频生成完成", "provider");
            return manager.save(VideoGeneration, current);
        });
    }

    async markGenerationCrashed(
        id: string,
        error: unknown,
        options: { errorMessage?: string; billingStatus?: VideoGenerationBillingStatus; refundOnFailure?: boolean } = {},
    ) {
        let transitioned = false;
        const failed = await this.withTransaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const current = await manager.findOne(VideoGeneration, {
                where: { id } as FindOptionsWhere<VideoGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!current || !canFailVideoGeneration(current.status)) return current;
            const category = this.classifyFailure(error);
            current.status = VideoGenerationStatus.FAILED;
            current.failureCategory = category;
            current.errorMessage = options.errorMessage ?? this.publicFailureMessage(category);
            current.billingStatus = options.billingStatus ?? current.billingStatus;
            current.progress = 100;
            current.completedAt = new Date();
            this.appendStatusEvent(current, VideoGenerationStatus.FAILED, current.errorMessage, "system");
            transitioned = true;
            return manager.save(VideoGeneration, current);
        });
        if (!failed) throw HttpErrorFactory.notFound("视频生成记录不存在");
        if (!transitioned) return failed;

        if (options.refundOnFailure !== false) {
            await this.refundIfNeeded(failed, failed.userId, "视频生成失败自动退款");
        }
        const current = await this.findGenerationById(id);
        await this.notifyTerminalStatus(current);
        return current;
    }

    async pollAndUpdate(id: string, userId: string) {
        return this.findOwnedById(id, userId);
    }

    async pollAndUpdateForWeb(id: string, userId: string) {
        return this.toPublicGeneration(await this.pollAndUpdate(id, userId));
    }

    async pollAnyAndUpdate(id: string) {
        return this.findGenerationById(id);
    }

    /** Return a summary of current local video task states. */
    async batchPollAndUpdate(statusFilter?: "pending" | "processing", limit = 50) {
        const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
        const where: Record<string, unknown> = {
            status: statusFilter
                ? In([statusFilter as VideoGenerationStatus])
                : In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
        };

        const records = await this.generationRepository.find({
            where: where as FindOptionsWhere<VideoGeneration>,
            order: { updatedAt: "ASC" },
            take,
        });

        return {
            total: records.length,
            succeeded: records.filter((item) => item.status === VideoGenerationStatus.SUCCEEDED).length,
            failed: records.filter((item) => item.status === VideoGenerationStatus.FAILED).length,
            stillProcessing: records.filter((item) => !isTerminalStatus(item.status)).length,
            updated: records.slice(0, 20),
        };
    }

    /** Health check: verify DB connectivity and model configuration completeness. */
    async healthCheck() {
        const activeTasks = await this.generationRepository.count({
            where: {
                status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
            } as FindOptionsWhere<VideoGeneration>,
        });
        const modelList = await this.modelConfigService.list({ page: 1, pageSize: 100 });
        const enabledModels = modelList.items.filter((model) => model.enabled && model.visibleToUser);
        const modelCompleteness = await this.modelConfigService.getConfigCompleteness();
        const recentFailureStats = await this.getRecentFailureStats();

        return {
            status: modelCompleteness.complete ? "ok" : "attention",
            enabledModelCount: enabledModels.length,
            modelCompleteness,
            activeTasks,
            recentFailures: recentFailureStats,
            checkedAt: new Date().toISOString(),
        };
    }

    async list(query: QueryVideoGenerationDto, userId?: string) {
        const whereClause: Record<string, unknown> = {};
        if (userId) {
            whereClause.userId = userId;
        }
        if (query.keyword) {
            whereClause.prompt = Like(`%${query.keyword}%`);
        }
        if (query.status) {
            whereClause.status = query.status;
        }
        if (query.model) {
            whereClause.model = query.model;
        }
        if (query.billingStatus) {
            whereClause.billingStatus = query.billingStatus;
        }
        if (query.failureCategory) {
            whereClause.failureCategory = query.failureCategory;
        }
        if (query.dateFrom && query.dateTo) {
            whereClause.createdAt = Between(new Date(query.dateFrom), new Date(query.dateTo));
        } else if (query.dateFrom) {
            whereClause.createdAt = MoreThanOrEqual(new Date(query.dateFrom));
        } else if (query.dateTo) {
            whereClause.createdAt = LessThanOrEqual(new Date(query.dateTo));
        }

        return this.paginate(query, {
            where: whereClause as FindOptionsWhere<VideoGeneration>,
            order: { [query.sortBy ?? "createdAt"]: (query.sortOrder ?? "DESC").toUpperCase() },
        });
    }

    async listForWeb(query: QueryVideoGenerationDto, userId: string) {
        const page = await this.list(query, userId);
        return {
            ...page,
            items: page.items.map((item) => this.toPublicGeneration(item)),
        };
    }

    /** Admin: find any record by id (no user check). */
    async findGenerationById(id: string) {
        const generation = await this.generationRepository.findOne({ where: { id } as FindOptionsWhere<VideoGeneration> });
        if (!generation) {
            throw HttpErrorFactory.notFound("视频生成记录不存在");
        }
        return generation;
    }

    /** Admin: delete any record by id (no user check). */
    async deleteOne(id: string) {
        const record = await this.findGenerationById(id);
        await this.deleteGenerationRecord(record);
        return { success: true, message: "删除成功" };
    }

    async updateAdminRemark(id: string, adminRemark: string) {
        const record = await this.findGenerationById(id);
        record.adminRemark = this.sanitizeText(adminRemark, 2000);
        await this.generationRepository.save(record);
        return record;
    }

    async markStatus(
        id: string,
        status: VideoGenerationStatus,
        message?: string,
        failureCategory?: string,
    ) {
        if (status !== VideoGenerationStatus.FAILED) {
            throw HttpErrorFactory.badRequest("Console 只能将任务标记为失败，成功必须由有效结果确认");
        }
        const failed = await this.markGenerationCrashed(
            id,
            new Error(message || "管理员标记失败"),
            { errorMessage: this.truncateText(message || "管理员标记失败", 2000) },
        );
        if (failed && failureCategory) {
            failed.failureCategory = failureCategory;
            await this.generationRepository.update(id, { failureCategory });
        }
        return failed;
    }

    async batchMarkFailed(ids: string[], message = "管理员批量标记失败") {
        const updated: VideoGeneration[] = [];
        for (const id of ids) {
            try {
                updated.push(await this.markStatus(id, VideoGenerationStatus.FAILED, message, "admin_batch"));
            } catch (error) {
                this.logger.warn(`Batch mark failed skipped ${id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { total: ids.length, updated: updated.length, items: updated };
    }

    async scanStaleProcessing(maxAgeMinutes = 30) {
        if (this.scanningStale) return;
        this.scanningStale = true;
        try {
            const nowMs = Date.now();
            const processingCutoff = new Date(nowMs - maxAgeMinutes * 60_000);
            const records = await this.generationRepository.find({
                where: {
                    status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
                    updatedAt: LessThanOrEqual(processingCutoff),
                } as FindOptionsWhere<VideoGeneration>,
                order: { updatedAt: "ASC" },
                take: 50,
            });
            const refundCandidates = await this.generationRepository.find({
                where: {
                    status: VideoGenerationStatus.FAILED,
                    billingStatus: VideoGenerationBillingStatus.DEDUCTED,
                } as FindOptionsWhere<VideoGeneration>,
                order: { updatedAt: "ASC" },
                take: 50,
            });
            for (const record of refundCandidates) {
                await this.refundIfNeeded(record, record.userId, "视频生成失败自动退款恢复");
            }

            let resumed = 0;
            let timedOut = 0;
            const updated: VideoGeneration[] = [];
            for (const record of records) {
                if (shouldResumeVideoGeneration(record, nowMs)) {
                    try {
                        const claimed = await this.claimVideoGenerationForRecovery(record.id, nowMs);
                        if (!claimed) continue;
                        await this.enqueueGenerationJob(record.id);
                        resumed += 1;
                    } catch (error) {
                        this.logger.warn(`Resume video generation ${record.id} failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    continue;
                }
                if (!shouldTimeoutVideoGeneration(record, nowMs)) continue;
                const failed = await this.markGenerationCrashed(
                    record.id,
                    new Error(`任务超过 ${maxAgeMinutes} 分钟未更新`),
                );
                if (failed) {
                    timedOut += 1;
                    updated.push(failed);
                }
            }
            return { total: records.length, resumed, timedOut, updated };
        } finally {
            this.scanningStale = false;
        }
    }

    private async claimVideoGenerationForRecovery(id: string, nowMs: number) {
        return this.generationRepository.manager.transaction(async (manager) => {
            await manager.query(LOCK_TIMEOUT);
            const generation = await manager.findOne(VideoGeneration, {
                where: { id } as FindOptionsWhere<VideoGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!generation || !shouldResumeVideoGeneration(generation, nowMs)) return null;
            await manager.update(VideoGeneration, id, {
                progress: getResumedVideoProgress(generation.progress),
                updatedAt: new Date(),
            });
            return generation;
        });
    }

    async cancelRecord(id: string, message = "管理员取消任务") {
        return this.markGenerationCrashed(
            id,
            new Error(message),
            { errorMessage: this.truncateText(message, 2000) },
        );
    }

    async batchCancel(ids: string[], message = "管理员批量取消任务") {
        const updated: VideoGeneration[] = [];
        for (const id of ids) {
            try {
                updated.push(await this.cancelRecord(id, message));
            } catch (error) {
                this.logger.warn(`Batch cancel skipped ${id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { total: ids.length, updated: updated.length, items: updated };
    }

    async retryRecord(id: string) {
        const record = await this.findGenerationById(id);
        if (!canRetryVideoGeneration(record.status, record.billingStatus)) {
            throw HttpErrorFactory.badRequest("生成任务的退款尚未完成，暂不能重试");
        }
        if (!record.modelConfigId) {
            throw HttpErrorFactory.badRequest("历史视频任务未保存模型配置，无法重试，请重新选择模型");
        }
        if (record.media?.some((item) => !item.fileId)) {
            throw HttpErrorFactory.badRequest("历史视频任务未保存 fileId，无法重试，请重新上传素材");
        }

        return this.createAndSubmit({
            prompt: record.prompt,
            originalPrompt: record.originalPrompt,
            promptOptimizationSource: record.promptOptimizationSource,
            promptOptimizationStyle: record.promptOptimizationStyle,
            promptOptimizerModelId: record.promptOptimizerModelId,
            modelConfigId: record.modelConfigId,
            requestKey: `${record.id}:admin-retry`,
            media: record.media,
            resolution: record.parameters?.resolution,
            duration: record.parameters?.duration,
            ratio: record.parameters?.ratio,
            watermark: record.parameters?.watermark,
        }, record.userId);
    }

    async batchRetry(ids: string[]) {
        const created: VideoGeneration[] = [];
        for (const id of ids) {
            try {
                created.push(await this.retryRecord(id));
            } catch (error) {
                this.logger.warn(`Batch retry skipped ${id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { total: ids.length, created: created.length, items: created };
    }

    async findOwnedById(id: string, userId: string) {
        const generation = await this.generationRepository.findOne({
            where: { id, userId } as FindOptionsWhere<VideoGeneration>,
        });

        if (!generation) {
            throw HttpErrorFactory.notFound("视频生成记录不存在");
        }

        return generation;
    }

    async findOwnedPublicById(id: string, userId: string) {
        return this.toPublicGeneration(await this.findOwnedById(id, userId));
    }

    private toPublicGeneration(record: VideoGeneration & { deletedAt?: Date | null }) {
        return {
            id: record.id,
            model: record.model,
            modelConfigId: record.modelConfigId,
            modelName: record.modelName,
            status: record.status,
            billingStatus: record.billingStatus,
            prompt: record.prompt,
            originalPrompt: record.originalPrompt,
            promptOptimizationSource: record.promptOptimizationSource,
            promptOptimizationStyle: record.promptOptimizationStyle,
            media: record.media,
            parameters: record.parameters,
            videoUrl: record.videoUrl,
            errorMessage: record.errorMessage,
            progress: record.progress,
            billingAmount: record.billingAmount,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            statusEvents: (record.statusEvents ?? []).map((event) => ({
                status: event.status,
                message: event.message,
                at: event.at,
            })),
        };
    }

    async deleteOwnedById(id: string, userId: string) {
        const record = await this.findOwnedById(id, userId);
        await this.deleteGenerationRecord(record);
        return { success: true, message: "删除成功" };
    }

    private async deleteGenerationRecord(record: VideoGeneration) {
        this.assertVideoCanBeDeleted(record);
        await this.delete(record.id);
        const relativePath = this.getGeneratedVideoStoragePath(record.videoUrl, record.id);
        if (relativePath) await this.deleteStoredResultVideo(relativePath);
    }

    private async generateWithProvider(record: VideoGeneration, modelConfig: ResolvedVideoModelConfig) {
        const media = record.media ?? [];
        const firstFrame = media.find((item) => item.type === "first_frame");
        if (media.some((item) => item.type !== "first_frame") || media.filter((item) => item.type === "first_frame").length > 1) {
            throw HttpErrorFactory.badRequest("当前统一视频生成链路仅支持文生视频或单首帧图生视频");
        }

        const prompt = firstFrame
            ? { text: record.prompt, image: firstFrame.url }
            : record.prompt;
        const result = await this.aiModelService.generateVideo(modelConfig.mainModelId, {
            prompt,
            duration: record.parameters?.duration,
            resolution: this.toSdkResolution(record.parameters?.resolution),
            aspectRatio: this.toSdkAspectRatio(record.parameters?.ratio),
            fps: modelConfig.capabilities?.fps,
            providerOptions: {
                [modelConfig.provider]: {
                    watermark: record.parameters?.watermark,
                },
            },
        });

        return {
            video: result.video,
            rawRequest: {
                model: modelConfig.model,
                prompt: record.prompt,
                media,
                parameters: record.parameters,
            },
            rawResponse: {
                videoCount: result.videos.length,
                warnings: result.warnings,
                responses: result.responses,
                providerMetadata: result.providerMetadata,
                apiMode: "ai-sdk-video",
            },
        };
    }

    private getGeneratedVideoStoragePath(videoUrl: string | undefined, generationId: string): string | undefined {
        const prefix = `/echoflow-video/uploads/`;
        if (!videoUrl?.startsWith(prefix)) return undefined;
        const relativePath = videoUrl.slice(prefix.length);
        const normalizedPath = path.posix.normalize(relativePath);
        const escapedId = generationId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const expectedPath = new RegExp(`^generated/\\d{4}/\\d{2}/${escapedId}\\.(mp4|webm|mov)$`);
        return relativePath === normalizedPath && expectedPath.test(normalizedPath) ? normalizedPath : undefined;
    }

    private async deleteStoredResultVideo(relativePath: string): Promise<void> {
        try {
            await this.fileStorageService.deleteFile(relativePath, { extensionId: EXTENSION_ID });
        } catch (error) {
            this.logger.error(`Failed to reclaim video result file ${relativePath}`, error);
        }
    }

    private async storeResultVideo(
        generationId: string,
        video: { uint8Array: Uint8Array; mediaType?: string },
    ) {
        const mimeType = video.mediaType || "video/mp4";
        const extension = this.extensionForVideoMimeType(mimeType);
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const relativePath = path.posix.join("generated", year, month, `${generationId}.${extension}`);
        const buffer = Buffer.from(video.uint8Array);
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_GENERATED_VIDEO_BYTES) {
            throw HttpErrorFactory.badRequest("生成视频结果超过大小限制");
        }

        await this.fileStorageService.saveBuffer(
            buffer,
            {
                path: path.posix.dirname(relativePath),
                fileName: path.posix.basename(relativePath),
                fullPath: relativePath,
            },
            { extensionId: EXTENSION_ID },
        );

        return {
            url: `/echoflow-video/uploads/${relativePath}`,
            mimeType,
            path: relativePath,
            size: buffer.byteLength,
        };
    }

    private toSdkResolution(value?: string) {
        return /^\d+x\d+$/.test(value ?? "") ? value as `${number}x${number}` : undefined;
    }

    private toSdkAspectRatio(value?: string) {
        return /^\d+:\d+$/.test(value ?? "") ? value as `${number}:${number}` : undefined;
    }

    private extensionForVideoMimeType(mimeType: string) {
        if (mimeType.includes("webm")) return "webm";
        if (mimeType.includes("quicktime")) return "mov";
        return "mp4";
    }

    private validateMediaForModelConfig(modelConfig: ResolvedVideoModelConfig, media: VideoMediaItem[]) {
        for (const item of media) {
            this.validateMediaUrl(item);
            this.validateMediaMimeType(item);
        }

        const firstFrames = media.filter((item) => item.type === "first_frame");
        const references = media.filter((item) => item.type === "reference_image");
        const videos = media.filter((item) => item.type === "video");
        const mediaTypes = modelConfig.capabilities.mediaTypes ?? [];
        const abilityTypes = modelConfig.capabilities.abilityTypes ?? [];
        const supportsFirstFrame = mediaTypes.includes("first_frame");
        const supportsReference = mediaTypes.includes("reference_image");
        const supportsVideo = mediaTypes.includes("video");

        if (!supportsFirstFrame && firstFrames.length > 0) {
            throw HttpErrorFactory.badRequest("当前模型不支持首帧图片素材");
        }
        if (!supportsReference && references.length > 0) {
            throw HttpErrorFactory.badRequest("当前模型不支持参考图素材");
        }
        if (!supportsVideo && videos.length > 0) {
            throw HttpErrorFactory.badRequest("当前模型不支持视频素材");
        }
        if (firstFrames.length > 0) {
            if (!abilityTypes.includes("first_frame_i2v")) {
                throw HttpErrorFactory.badRequest("当前模型不支持图生视频");
            }
            if (firstFrames.length !== 1 || references.length > 0 || videos.length > 0) {
                throw HttpErrorFactory.badRequest("图生视频模型必须且只能提交 1 张首帧图片");
            }
        }
        if (references.length > 0) {
            if (!abilityTypes.includes("reference_to_video") && !abilityTypes.includes("video_editing")) {
                throw HttpErrorFactory.badRequest("当前模型不支持参考图素材");
            }
            if (references.length < 1 || references.length > 4) {
                throw HttpErrorFactory.badRequest("参考图生视频模型必须提交 1-4 张参考图");
            }
        }
        if (videos.length > 0) {
            if (!abilityTypes.includes("video_editing") && !abilityTypes.includes("action_transfer")) {
                throw HttpErrorFactory.badRequest("当前模型不支持视频编辑");
            }
            if (videos.length !== 1 || firstFrames.length > 0) {
                throw HttpErrorFactory.badRequest("视频编辑模型必须提交 1 个视频，可选 0-4 张参考图");
            }
        }
        if (!mediaTypes.length && media.length > 0) {
            throw HttpErrorFactory.badRequest("文生视频模型不需要媒体素材");
        }
        if (media.length === 0 && !abilityTypes.includes("text_to_video")) {
            throw HttpErrorFactory.badRequest("当前模型需要上传素材");
        }
    }

    private validateMediaUrl(item: VideoMediaItem) {
        const value = item.url;
        if (!value || value.length > 2048) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 不能为空且长度不能超过 2048");
        }

        let url: URL;
        try {
            url = new URL(value);
        } catch {
            throw HttpErrorFactory.badRequest("媒体素材 URL 格式不正确");
        }

        if (!["http:", "https:"].includes(url.protocol)) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 仅支持 http/https");
        }

        if (url.username || url.password) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 不允许包含用户名或密码");
        }

        const isPlatformUpload =
            Boolean(item.fileId) &&
            (url.pathname.startsWith("/echoflow-video/uploads/") ||
                url.pathname.startsWith("/uploads/"));

        if (!isPlatformUpload) {
            try {
                normalizePublicHttpUrl(value);
            } catch {
                throw HttpErrorFactory.badRequest("媒体素材 URL 不允许指向本机或内网地址");
            }
        }

        if (isPlatformUpload && (!["http:", "https:"].includes(url.protocol) || url.username || url.password)) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 不允许指向本机或内网地址");
        }
    }

    private async normalizeAndValidateMedia(media: VideoMediaItem[], userId: string) {
        const normalized = await Promise.all(
            media.map(async (item) => {
                if (!item.fileId) {
                    throw HttpErrorFactory.badRequest("媒体素材必须先通过平台上传");
                }

                const file = await this.fileUploadService.findOneById(item.fileId);
                if (!file) {
                    throw HttpErrorFactory.badRequest("媒体素材文件不存在");
                }
                if ((file as { deletedAt?: Date | null }).deletedAt) {
                    throw HttpErrorFactory.badRequest("媒体素材文件已删除");
                }
                if (file.uploaderId !== userId) {
                    throw HttpErrorFactory.badRequest("媒体素材不属于当前用户");
                }
                if (file.extensionIdentifier !== "echoflow-video") {
                    throw HttpErrorFactory.badRequest("媒体素材不属于当前插件上传文件");
                }
                if (!file.url) {
                    throw HttpErrorFactory.badRequest("媒体素材缺少可访问地址");
                }
                if (!file.size || file.size <= 0) {
                    throw HttpErrorFactory.badRequest("媒体素材大小无效");
                }
                if (file.size > 1024 * 1024 * 1024) {
                    throw HttpErrorFactory.badRequest("媒体素材不能超过 1GB");
                }

                const normalizedItem: VideoMediaItem = {
                    ...item,
                    url: file.url,
                    mimeType: file.mimeType,
                    fileName: file.originalName,
                    size: file.size,
                };
                this.validateMediaUrl(normalizedItem);
                this.validateMediaMimeType(normalizedItem);
                return normalizedItem;
            }),
        );

        return normalized;
    }

    private async hasBillingLog(
        associationNo: string,
        action: (typeof ACTION)[keyof typeof ACTION],
        manager?: EntityManager,
    ) {
        return this.billingService.hasBillingLog({ associationNo, action }, manager);
    }

    private assertVideoCanBeDeleted(record: VideoGeneration) {
        if ([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING].includes(record.status)) {
            throw HttpErrorFactory.badRequest("视频任务处理中，完成或失败后才能删除");
        }
    }

    private validateMediaMimeType(item: VideoMediaItem) {
        if (!item.mimeType) return;

        if (item.type === "video") {
            if (!item.mimeType.startsWith("video/")) {
                throw HttpErrorFactory.badRequest("视频素材的文件类型不正确");
            }
            return;
        }

        if (!item.mimeType.startsWith("image/")) {
            throw HttpErrorFactory.badRequest("图片素材的文件类型不正确");
        }
    }

    private async refundIfNeeded(record: VideoGeneration, userId: string, remark: string) {
        if (record.billingRuleSnapshot?.refundOnFailure === false) {
            return;
        }

        try {
            await this.withTransaction(async (manager) => {
                await manager.query(LOCK_TIMEOUT);
                const locked = await manager.findOne(VideoGeneration, {
                    where: { id: record.id } as FindOptionsWhere<VideoGeneration>,
                    lock: { mode: "pessimistic_write" },
                });
                if (!locked) {
                    throw HttpErrorFactory.notFound("视频生成记录不存在");
                }
                if (locked.status === VideoGenerationStatus.SUCCEEDED) {
                    record.billingStatus = locked.billingStatus;
                    return;
                }
                if (
                    !locked.billingAmount ||
                    locked.billingAmount <= 0 ||
                    locked.billingRuleSnapshot?.refundOnFailure === false
                ) {
                    return;
                }

                const wasDeducted =
                    locked.billingStatus === VideoGenerationBillingStatus.DEDUCTED ||
                    await this.hasBillingLog(locked.id, ACTION.DEC, manager);
                if (!wasDeducted) {
                    return;
                }

                const duplicateRefund = await this.hasBillingLog(locked.id, ACTION.INC, manager);
                if (locked.billingStatus !== VideoGenerationBillingStatus.REFUNDED && !duplicateRefund) {
                    await this.billingService.addUserPower({
                        userId: locked.userId,
                        amount: locked.billingAmount,
                        remark,
                        associationNo: locked.id,
                        associationUserId: locked.userId,
                    }, manager);
                }
                locked.billingStatus = VideoGenerationBillingStatus.REFUNDED;
                await manager.save(VideoGeneration, locked);
                record.billingStatus = locked.billingStatus;
            });
        } catch (error) {
            this.logger.error(`Video generation ${record.id} billing refund failed`, error);
            await this.recordRefundFailureMetadata(record, error);
            record.errorMessage = this.truncateText(
                `${record.errorMessage || "任务失败"}（退款失败，请联系管理员）`,
                2000,
            );
        }
    }

    private async recordRefundFailureMetadata(record: VideoGeneration, error: unknown) {
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
                `Persist video generation ${record.id} refund failure metadata failed: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`,
            );
        }
    }

    private async notifyTerminalStatus(record: VideoGeneration) {
        if (!isTerminalStatus(record.status)) return;

        const succeeded = record.status === VideoGenerationStatus.SUCCEEDED;
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
                    taskName: record.modelName || record.model || "视频任务",
                    modelName: record.modelName || record.model,
                    reason: record.errorMessage || "请稍后重试或联系管理员",
                    completedAt: record.completedAt?.toISOString(),
                },
            });
        } catch (error) {
            this.logger.warn(
                `Notify video generation ${record.id} terminal status failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async saveNonTerminalUpdate(record: VideoGeneration) {
        return this.withTransaction(async (manager) => {
            const locked = await manager.findOne(VideoGeneration, {
                where: { id: record.id } as FindOptionsWhere<VideoGeneration>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) {
                throw HttpErrorFactory.notFound("视频生成记录不存在");
            }
            if (locked.deletedAt || isTerminalStatus(locked.status)) {
                return locked;
            }

            locked.status = record.status;
            locked.billingStatus = record.billingStatus;
            locked.videoUrl = record.videoUrl;
            locked.errorMessage = record.errorMessage;
            locked.failureCategory = record.failureCategory;
            locked.progress = record.progress;
            locked.completedAt = record.completedAt;
            locked.rawRequest = record.rawRequest;
            locked.rawResponse = record.rawResponse;
            locked.statusEvents = record.statusEvents;
            return manager.save(VideoGeneration, locked);
        });
    }

    private sanitizeText(text: string, maxLength: number): string {
        return text.replace(/<[^>]*>/g, "").slice(0, maxLength);
    }

    private truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    }

    private classifyFailure(error: unknown): string {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes("401") || message.includes("api key") || message.includes("鉴权")) return "auth";
        if (message.includes("403") || message.includes("权限")) return "permission";
        if (message.includes("429") || message.includes("频繁") || message.includes("rate")) return "rate_limit";
        if (message.includes("timeout") || message.includes("超时") || message.includes("etimedout")) return "timeout";
        if (message.includes("balance") || message.includes("余额")) return "provider_balance";
        if (message.includes("参数") || message.includes("400")) return "invalid_request";
        return "upstream";
    }

    private publicFailureMessage(category?: string): string {
        if (category === "rate_limit") return "视频服务当前繁忙，请稍后重试；如已扣费将按账务结果处理。";
        if (category === "timeout") return "视频服务响应超时，请稍后重试；如已扣费将按账务结果处理。";
        if (category === "auth" || category === "permission") return "视频服务配置暂不可用，请稍后重试。";
        if (category === "invalid_request") return "视频生成参数无效，请调整后重试。";
        return "视频服务暂不可用，请稍后重试；如已扣费将按账务结果处理。";
    }

    private async getRecentFailureStats() {
        const since = new Date(Date.now() - 24 * 60 * 60_000);
        const failures = await this.generationRepository.find({
            where: {
                status: VideoGenerationStatus.FAILED,
                updatedAt: MoreThanOrEqual(since),
            } as FindOptionsWhere<VideoGeneration>,
            select: ["id", "failureCategory", "errorMessage", "updatedAt"],
            order: { updatedAt: "DESC" },
            take: 100,
        });
        const byCategory = failures.reduce<Record<string, number>>((acc, item) => {
            const key = item.failureCategory || "unknown";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        const provider5xx = failures.filter((item) =>
            /(^|\D)5\d\d(\D|$)|service unavailable|bad gateway|gateway timeout/i.test(item.errorMessage || ""),
        ).length;

        return {
            windowHours: 24,
            total: failures.length,
            provider5xx,
            byCategory,
        };
    }

    private makeStatusEvent(
        status: VideoGenerationStatus,
        message?: string,
        source: "web" | "console" | "provider" | "system" = "system",
    ) {
        return {
            status,
            message,
            source,
            at: new Date().toISOString(),
        };
    }

    private appendStatusEvent(
        record: VideoGeneration,
        status: VideoGenerationStatus,
        message?: string,
        source: "web" | "console" | "provider" | "system" = "system",
    ) {
        record.statusEvents = [...(record.statusEvents ?? []), this.makeStatusEvent(status, message, source)];
    }

    private compactRawPayload(payload: Record<string, unknown>): Record<string, unknown> {
        const MAX_STRING_LENGTH = 10_000;
        const MAX_TOTAL_LENGTH = 60_000;
        let stringTruncations = 0;

        try {
            const text = JSON.stringify(payload, (_key, value) => {
                if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
                    stringTruncations++;
                    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
                }
                return value;
            });

            if (text.length > MAX_TOTAL_LENGTH) {
                this.logger.warn(
                    `Raw payload exceeded ${MAX_TOTAL_LENGTH} chars (actual ${text.length}), truncating`,
                );
                return {
                    _truncated: true,
                    _originalLength: text.length,
                    preview: text.slice(0, MAX_TOTAL_LENGTH),
                };
            }

            const result = safeJsonParse<Record<string, unknown>>(text);
            if (!result) return { preview: text.slice(0, MAX_TOTAL_LENGTH) };
            if (stringTruncations > 0) {
                result._stringTruncations = stringTruncations;
            }
            return result;
        } catch {
            return { _truncated: true, _error: "raw payload is not serializable" };
        }
    }

    private isUniqueConstraintError(error: unknown): boolean {
        if (!error || typeof error !== "object") return false;
        const err = error as { code?: string; message?: string };
        return err.code === "23505" || (err.message?.includes("duplicate key") ?? false);
    }

    private validateParamsForModelConfig(
        modelConfig: ResolvedVideoModelConfig,
        dto: CreateVideoGenerationDto,
    ) {
        const capabilities = modelConfig.capabilities ?? {};
        const duration = dto.duration ?? modelConfig.defaultParams.duration;
        const durationCapability = capabilities.duration;
        if (duration && durationCapability?.allowedValues?.length && !durationCapability.allowedValues.includes(duration)) {
            throw HttpErrorFactory.badRequest(
                `视频时长仅支持: ${durationCapability.allowedValues.join(", ")} 秒`,
            );
        }
        if (duration && durationCapability?.min && duration < durationCapability.min) {
            throw HttpErrorFactory.badRequest(`视频时长不能小于 ${durationCapability.min} 秒`);
        }
        if (duration && durationCapability?.max && duration > durationCapability.max) {
            throw HttpErrorFactory.badRequest(`视频时长不能超过 ${durationCapability.max} 秒`);
        }

        const resolution = dto.resolution ?? modelConfig.defaultParams.resolution;
        if (resolution && capabilities.resolutions?.length && !capabilities.resolutions.includes(resolution)) {
            throw HttpErrorFactory.badRequest(`分辨率仅支持: ${capabilities.resolutions.join(", ")}`);
        }

        const ratio = dto.ratio ?? modelConfig.defaultParams.ratio;
        if (ratio && capabilities.ratios?.length && !capabilities.ratios.includes(ratio)) {
            throw HttpErrorFactory.badRequest(`画幅比例仅支持: ${capabilities.ratios.join(", ")}`);
        }
    }
}

export const generationModuleEntities = [
    VideoGeneration,
    VideoProviderConfig,
    VideoModelConfig,
    VideoBillingRule,
    VideoPromptTemplate,
    VideoPolicyConfig,
    VideoConfigAudit,
    VideoPromptOptimization,
];
export const generationModuleProviders = [
    GenerationService,
    ProviderConfigService,
    ModelConfigService,
    BillingRuleService,
    TemplateService,
    PolicyService,
    PromptOptimizationService,
];

function isTerminalStatus(status: string): boolean {
    return ["succeeded", "success", "SUCCEEDED", "completed", "complete", "failed", "cancelled", "canceled", "FAILED", "CANCELED", "error"].includes(status);
}
