import { BaseService } from "@buildingai/base";
import { ACCOUNT_LOG_TYPE, ACTION } from "@buildingai/constants/shared/account-log.constants";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    PublicAiModelService,
} from "@buildingai/extension-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel, File } from "@buildingai/db/entities";
import type { EntityManager, FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";

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
import { VideoGatewayClient } from "./video-gateway-client";
import { VIDEO_POLL_JOB, VIDEO_POLL_QUEUE } from "./video-poll-queue.constants";

const VIDEO_POLL_DELAY_MS = 15_000;
const VIDEO_POLL_JOB_PREFIX = "video-poll";
const EXTENSION_ID = "echoflow-video";

@Injectable()
export class GenerationService extends BaseService<VideoGeneration> implements OnModuleInit {
    protected readonly logger = new Logger(GenerationService.name);

    constructor(
        @InjectRepository(VideoGeneration)
        private readonly generationRepository: Repository<VideoGeneration>,
        @InjectRepository(File)
        private readonly fileRepository: Repository<File>,
        @InjectRepository(AccountLog)
        private readonly accountLogRepository: Repository<AccountLog>,
        private readonly billingService: ExtensionBillingService,
        private readonly providerConfigService: ProviderConfigService,
        private readonly modelConfigService: ModelConfigService,
        private readonly billingRuleService: BillingRuleService,
        private readonly policyService: PolicyService,
        private readonly notificationService: ExtensionNotificationService,
        @InjectQueue(VIDEO_POLL_QUEUE)
        private readonly videoPollQueue: Queue,
    ) {
        super(generationRepository);
    }

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
    }

    /** Return admin-enabled model options for web/console selectors. */
    async listModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    async createAndSubmitForWeb(dto: CreateVideoGenerationDto, userId: string) {
        return this.toPublicGeneration(await this.createAndSubmit(dto, userId));
    }

    /**
     * Submit a video generation task through the model-level API endpoint.
     *
     * Flow:
     * 1. Validate input
     * 2. Create DB record (status = PROCESSING)
     * 3. Submit to the configured video endpoint
     * 4. Save taskId
     * 5. Return record
     */
    async createAndSubmit(dto: CreateVideoGenerationDto, userId: string) {
        const modelConfig = await this.modelConfigService.findEnabledByModel(dto.model);
        const model = modelConfig.model;
        const prompt = this.sanitizeText(dto.prompt, 4000);
        const media = await this.normalizeAndValidateMedia(dto.media ?? [], userId);
        const normalizedDto = { ...dto, media };
        await this.policyService.validateGeneration(userId, modelConfig.id, normalizedDto);
        this.validateMediaForModelConfig(modelConfig, media);
        this.validateParamsForModelConfig(modelConfig, normalizedDto);
        const generationParams = {
            resolution: dto.resolution ?? modelConfig.defaultParams.resolution,
            duration: dto.duration ?? modelConfig.defaultParams.duration,
            ratio: dto.ratio ?? modelConfig.defaultParams.ratio,
            watermark: dto.watermark ?? modelConfig.defaultParams.watermark,
            audio_setting: dto.audioSetting,
        };
        const billingAmount = await this.billingRuleService.calculateAmount({
            modelConfigId: modelConfig.id,
            model: modelConfig.model,
            duration: generationParams.duration,
            resolution: generationParams.resolution,
        });
        const billingRule = await this.billingRuleService.resolveRule(modelConfig.id, modelConfig.model);

        if (dto.requestKey) {
            const existing = await this.generationRepository.findOne({
                where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<VideoGeneration>,
            });
            if (existing) {
                this.logger.warn(
                    `Duplicate video requestKey ${dto.requestKey} for user ${userId}, returning ${existing.id}`,
                );
                return existing;
            }
        }

        const hasPower = await this.billingService.hasSufficientPower(userId, billingAmount);
        if (!hasPower) {
            throw HttpErrorFactory.badRequest("可用算力不足，请充值后重试");
        }

        const { endpoint, apiKey, baseUrl } = await this.modelConfigService.resolveRuntimeEndpoint(modelConfig);
        const client = new VideoGatewayClient(modelConfig, endpoint, apiKey, baseUrl);

        // Create DB record
        const record = this.generationRepository.create({
            userId,
            requestKey: dto.requestKey,
            model,
            modelConfigId: modelConfig.id,
            provider: modelConfig.provider,
            modelName: modelConfig.displayName,
            status: VideoGenerationStatus.PROCESSING,
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
            progress: 5,
            startedAt: new Date(),
            statusEvents: [
                this.makeStatusEvent(
                    VideoGenerationStatus.PROCESSING,
                    "任务已创建，等待提交到视频接口",
                    "web",
                ),
            ],
        });

        let saved: VideoGeneration;
        try {
            saved = await this.generationRepository.save(record);
        } catch (error) {
            if (dto.requestKey && this.isUniqueConstraintError(error)) {
                const existing = await this.generationRepository.findOne({
                    where: { userId, requestKey: dto.requestKey } as FindOptionsWhere<VideoGeneration>,
                });
                if (existing) {
                    this.logger.warn(
                        `Duplicate video requestKey ${dto.requestKey} for user ${userId}, returning ${existing.id}`,
                    );
                    return existing;
                }
            }
            throw error;
        }

        try {
            saved = await this.withTransaction(async (manager) => {
                const locked = await manager.findOne(VideoGeneration, {
                    where: { id: saved.id } as FindOptionsWhere<VideoGeneration>,
                    lock: { mode: "pessimistic_write" },
                });
                if (!locked) {
                    throw HttpErrorFactory.notFound("视频生成记录不存在");
                }

                const duplicateDeduction = await this.hasBillingLog(locked.id, ACTION.DEC, manager);
                if (!duplicateDeduction) {
                    await this.billingService.deductUserPower({
                        userId,
                        amount: billingAmount,
                        remark: `Echoflow Video: ${model}`,
                        associationNo: locked.id,
                        associationUserId: userId,
                    }, manager);
                }
                locked.billingStatus = VideoGenerationBillingStatus.DEDUCTED;
                return manager.save(VideoGeneration, locked);
            });
        } catch (error) {
            saved.status = VideoGenerationStatus.FAILED;
            saved.billingStatus = VideoGenerationBillingStatus.FAILED;
            saved.errorMessage = "算力扣费失败，请稍后重试";
            saved.failureCategory = "billing";
            saved.completedAt = new Date();
            this.appendStatusEvent(saved, VideoGenerationStatus.FAILED, "算力扣费失败", "system");
            await this.generationRepository.save(saved);
            this.logger.error(`Video generation ${saved.id} billing deduction failed`, error);
            throw HttpErrorFactory.badRequest("算力扣费失败，请稍后重试");
        }

        try {
            const result = await client.submitTask({
                model,
                prompt,
                media,
                parameters: generationParams,
            });

            saved.taskId = result.taskId;
            saved.rawRequest = this.compactRawPayload(result.rawRequest);
            saved.rawResponse = this.compactRawPayload(result.rawResponse);
            saved.progress = 20;
            this.appendStatusEvent(saved, VideoGenerationStatus.PROCESSING, "任务已提交到视频接口", "provider");
            await this.generationRepository.save(saved);
            await this.schedulePollJob(saved.id, VIDEO_POLL_DELAY_MS);

            this.logger.log(`Video generation ${saved.id} submitted: taskId=${result.taskId}`);
            return saved;
        } catch (error) {
            // Submission failed
            saved.status = VideoGenerationStatus.FAILED;
            saved.errorMessage = this.truncateText(
                error instanceof Error ? error.message : "任务提交失败",
                2000,
            );
            saved.failureCategory = this.classifyFailure(error);
            saved.completedAt = new Date();
            this.appendStatusEvent(saved, VideoGenerationStatus.FAILED, "任务提交失败", "provider");
            await this.refundIfNeeded(saved, userId, "视频任务提交失败自动退款");
            await this.generationRepository.save(saved);
            this.logger.error(`Video generation ${saved.id} submission failed`, error);
            throw error;
        }
    }

    /**
     * Poll the provider task status and update the DB record.
     * Returns the updated record. If the task has reached a terminal state
     * (succeeded/failed), the record is finalized.
     */
    async pollAndUpdate(id: string, userId: string) {
        const record = await this.findOwnedById(id, userId);
        return this.pollRecord(record, userId);
    }

    async pollAndUpdateForWeb(id: string, userId: string) {
        return this.toPublicGeneration(await this.pollAndUpdate(id, userId));
    }

    async pollAnyAndUpdate(id: string, options: { scheduleNext?: boolean } = {}) {
        const record = await this.findGenerationById(id);
        return this.pollRecord(record, record.userId, options);
    }

    /** Batch poll all pending/processing tasks. Returns summary. */
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

        let succeeded = 0;
        let failed = 0;
        let stillProcessing = 0;
        const updated: VideoGeneration[] = [];

        for (const record of records) {
            try {
                const result = await this.pollRecord(record, record.userId);
                updated.push(result);
                if (result.status === VideoGenerationStatus.SUCCEEDED) succeeded++;
                else if (result.status === VideoGenerationStatus.FAILED) failed++;
                else stillProcessing++;
            } catch {
                stillProcessing++;
            }
        }

        return {
            total: records.length,
            succeeded,
            failed,
            stillProcessing,
            updated: updated.slice(0, 20),
        };
    }

    /** Health check: verify DB connectivity and model endpoint completeness. */
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
        const missingEndpointModels = enabledModels.filter((model) => {
            const endpoints = model.endpoints ?? [];
            return !endpoints.some((endpoint) => endpoint.enabled && endpoint.secretId);
        });

        return {
            status: missingEndpointModels.length === 0 ? "ok" : "attention",
            enabledModelCount: enabledModels.length,
            modelCompleteness,
            missingEndpointModels: missingEndpointModels.map((model) => model.model),
            activeTasks,
            recentFailures: recentFailureStats,
            checkedAt: new Date().toISOString(),
        };
    }

    private async pollRecord(record: VideoGeneration, userId: string, options: { scheduleNext?: boolean } = {}) {
        // If already in a terminal state, just return
        if (isTerminalStatus(record.status)) {
            return record;
        }

        if (!record.taskId) {
            record.status = VideoGenerationStatus.FAILED;
            record.errorMessage = "任务 ID 丢失，无法轮询";
            record.failureCategory = "provider_task_missing";
            record.completedAt = new Date();
            this.appendStatusEvent(record, VideoGenerationStatus.FAILED, "任务 ID 丢失，无法轮询", "system");
            await this.refundIfNeeded(record, userId, "视频任务 ID 丢失自动退款");
            const saved = await this.saveNonTerminalUpdate(record);
            await this.notifyTerminalStatus(saved);
            await this.scheduleNextPollIfNeeded(saved, options);
            return saved;
        }

        const modelConfig = await this.modelConfigService.findEnabledByModel(record.model);
        const { endpoint, apiKey, baseUrl } = await this.modelConfigService.resolveRuntimeEndpoint(modelConfig);
        const client = new VideoGatewayClient(modelConfig, endpoint, apiKey, baseUrl);

        try {
            const pollResult = await client.pollTask(record.taskId);

            // Update raw response on every poll for debugging
            record.rawResponse = this.compactRawPayload(pollResult.rawResponse);

            if (isSuccessStatus(pollResult.status)) {
                const videoUrl = this.normalizeResultVideoUrl(pollResult.videoUrl);
                if (videoUrl) {
                    record.status = VideoGenerationStatus.SUCCEEDED;
                    record.videoUrl = videoUrl;
                    record.progress = 100;
                    record.completedAt = new Date();
                    this.appendStatusEvent(record, VideoGenerationStatus.SUCCEEDED, "视频生成完成", "provider");
                } else {
                    record.status = VideoGenerationStatus.FAILED;
                    record.errorMessage = "视频任务完成但未返回有效视频地址";
                    record.failureCategory = "provider_missing_output";
                    record.progress = 100;
                    record.completedAt = new Date();
                    this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "provider");
                    await this.refundIfNeeded(record, userId, "视频生成结果缺失自动退款");
                }
            } else if (isFailedStatus(pollResult.status)) {
                record.status = VideoGenerationStatus.FAILED;
                record.errorMessage = `视频任务失败: status=${pollResult.status}`;
                record.failureCategory = "provider_failed";
                record.progress = 100;
                record.completedAt = new Date();
                this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "provider");
                await this.refundIfNeeded(record, userId, "视频生成失败自动退款");
            } else {
                record.progress = Math.max(record.progress ?? 20, 35);
            }
            // else: still processing, keep status as-is

            const saved = await this.saveNonTerminalUpdate(record);
            await this.notifyTerminalStatus(saved);
            await this.scheduleNextPollIfNeeded(saved, options);
            return saved;
        } catch (error) {
            this.logger.error(`Poll failed for generation ${record.id}`, error);
            // Don't mark as failed on poll error — let the frontend retry
            throw error;
        }
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
        this.assertVideoCanBeDeleted(record);
        await this.delete(id);
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
        const record = await this.findGenerationById(id);
        record.status = status;
        if (status === VideoGenerationStatus.FAILED) {
            record.errorMessage = this.truncateText(message || record.errorMessage || "管理员标记失败", 2000);
            record.failureCategory = failureCategory || record.failureCategory || "admin_marked";
            record.progress = 100;
            record.completedAt = record.completedAt ?? new Date();
            await this.refundIfNeeded(record, record.userId, "管理员标记失败自动退款");
        } else if (status === VideoGenerationStatus.SUCCEEDED) {
            record.progress = 100;
            record.completedAt = record.completedAt ?? new Date();
        }
        this.appendStatusEvent(record, status, message || "管理员更新状态", "console");
        const saved = await this.saveNonTerminalUpdate(record);
        await this.notifyTerminalStatus(saved);
        return saved;
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
        const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
        const records = await this.generationRepository.find({
            where: {
                status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
                updatedAt: LessThanOrEqual(cutoff),
            } as FindOptionsWhere<VideoGeneration>,
        });
        const updated: VideoGeneration[] = [];
        for (const record of records) {
            record.status = VideoGenerationStatus.FAILED;
            record.errorMessage = `任务超过 ${maxAgeMinutes} 分钟未更新，已自动标记失败`;
            record.failureCategory = "processing_timeout";
            record.progress = 100;
            record.completedAt = new Date();
            this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "system");
            await this.refundIfNeeded(record, record.userId, "视频任务超时自动退款");
            const saved = await this.saveNonTerminalUpdate(record);
            await this.notifyTerminalStatus(saved);
            updated.push(saved);
        }
        return { total: records.length, updated };
    }

    async cancelRecord(id: string, message = "管理员取消任务") {
        const record = await this.findGenerationById(id);
        if (isTerminalStatus(record.status)) {
            return record;
        }
        record.status = VideoGenerationStatus.FAILED;
        record.errorMessage = this.truncateText(message, 2000);
        record.failureCategory = "admin_cancelled";
        record.progress = 100;
        record.completedAt = new Date();
        this.appendStatusEvent(record, VideoGenerationStatus.FAILED, message, "console");
        await this.refundIfNeeded(record, record.userId, "管理员取消任务自动退款");
        const saved = await this.saveNonTerminalUpdate(record);
        await this.notifyTerminalStatus(saved);
        return saved;
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
        if (record.status !== VideoGenerationStatus.FAILED) {
            throw HttpErrorFactory.badRequest("只有失败任务可以重试");
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
            model: record.model,
            requestKey: `${record.id}:admin-retry:${Date.now()}`,
            media: record.media,
            resolution: record.parameters?.resolution,
            duration: record.parameters?.duration,
            ratio: record.parameters?.ratio,
            watermark: record.parameters?.watermark,
            audioSetting: record.parameters?.audio_setting,
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
        const {
            userId: _userId,
            taskId: _taskId,
            adminRemark: _adminRemark,
            rawRequest: _rawRequest,
            rawResponse: _rawResponse,
            billingRuleSnapshot: _billingRuleSnapshot,
            deletedAt: _deletedAt,
            ...publicRecord
        } = record;
        return publicRecord;
    }

    async deleteOwnedById(id: string, userId: string) {
        const record = await this.findOwnedById(id, userId);
        this.assertVideoCanBeDeleted(record);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    /** Find a generation record by provider taskId. */
    async findByTaskId(taskId: string) {
        return this.generationRepository.findOne({
            where: { taskId } as FindOptionsWhere<VideoGeneration>,
        });
    }

    /** Process a webhook status update for a task. */
    async processWebhookUpdate(taskId: string, status: string, videoUrl?: string) {
        const record = await this.findByTaskId(taskId);
        if (!record) {
            this.logger.warn(`Webhook for unknown taskId: ${taskId}`);
            return null;
        }

        if (isTerminalStatus(record.status)) {
            return record;
        }

        if (isSuccessStatus(status)) {
            const normalizedVideoUrl = this.normalizeResultVideoUrl(videoUrl);
            if (normalizedVideoUrl) {
                record.status = VideoGenerationStatus.SUCCEEDED;
                record.videoUrl = normalizedVideoUrl;
                record.progress = 100;
                record.completedAt = new Date();
                this.appendStatusEvent(record, VideoGenerationStatus.SUCCEEDED, "视频回调成功", "webhook");
            } else {
                record.status = VideoGenerationStatus.FAILED;
                record.errorMessage = "视频回调成功但未返回有效视频地址";
                record.failureCategory = "provider_missing_output";
                record.progress = 100;
                record.completedAt = new Date();
                this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "webhook");
                await this.refundIfNeeded(record, record.userId, "视频回调结果缺失自动退款");
            }
        } else if (isFailedStatus(status)) {
            record.status = VideoGenerationStatus.FAILED;
            record.errorMessage = `视频回调: status=${status}`;
            record.failureCategory = "provider_webhook_failed";
            record.progress = 100;
            record.completedAt = new Date();
            this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "webhook");
            await this.refundIfNeeded(record, record.userId, "视频生成失败自动退款");
        }

        const saved = await this.saveNonTerminalUpdate(record);
        await this.notifyTerminalStatus(saved);
        this.logger.log(`Webhook processed: taskId=${taskId} status=${saved.status}`);
        return saved;
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

        if (this.isPrivateOrLocalHost(url.hostname) && !isPlatformUpload) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 不允许指向本机或内网地址");
        }
    }

    private async normalizeAndValidateMedia(media: VideoMediaItem[], userId: string) {
        const normalized = await Promise.all(
            media.map(async (item) => {
                if (!item.fileId) {
                    throw HttpErrorFactory.badRequest("媒体素材必须先通过平台上传");
                }

                const file = await this.fileRepository.findOne({
                    where: { id: item.fileId } as FindOptionsWhere<File>,
                });
                if (!file) {
                    throw HttpErrorFactory.badRequest("媒体素材文件不存在");
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

    private normalizeResultVideoUrl(raw?: string) {
        const value = raw?.trim();
        if (!value) {
            return undefined;
        }

        let url: URL;
        try {
            url = new URL(value);
        } catch {
            return undefined;
        }

        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
            return undefined;
        }
        if (this.isPrivateOrLocalHost(url.hostname)) {
            return undefined;
        }

        return url.toString();
    }

    private isPrivateOrLocalHost(hostname: string): boolean {
        const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
        return (
            host === "localhost" ||
            host === "0.0.0.0" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host.endsWith(".local") ||
            host.startsWith("10.") ||
            host.startsWith("127.") ||
            host.startsWith("169.254.") ||
            host.startsWith("192.168.") ||
            /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        );
    }

    private async hasBillingLog(
        associationNo: string,
        action: (typeof ACTION)[keyof typeof ACTION],
        manager?: EntityManager,
    ) {
        const repository = manager?.getRepository(AccountLog) ?? this.accountLogRepository;
        return repository.exists({
            where: {
                associationNo,
                accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC,
                action,
            } as FindOptionsWhere<AccountLog>,
        });
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
            record.errorMessage = this.truncateText(
                `${record.errorMessage || "任务失败"}（退款失败，请联系管理员）`,
                2000,
            );
        }
    }

    private async scheduleNextPollIfNeeded(record: VideoGeneration, options: { scheduleNext?: boolean }) {
        if (!options.scheduleNext || isTerminalStatus(record.status) || !record.taskId) {
            return;
        }
        await this.schedulePollJob(record.id, VIDEO_POLL_DELAY_MS);
    }

    private async schedulePollJob(id: string, delayMs: number) {
        try {
            await this.videoPollQueue.add(
                VIDEO_POLL_JOB,
                { id },
                {
                    jobId: `${VIDEO_POLL_JOB_PREFIX}-${id}-${Date.now()}`,
                    delay: Math.max(delayMs, 0),
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Schedule video poll ${id} failed: ${message}`, error);
            await this.recordPollScheduleFailure(id, message);
        }
    }

    private async recordPollScheduleFailure(id: string, message: string) {
        const record = await this.generationRepository.findOne({
            where: { id } as FindOptionsWhere<VideoGeneration>,
        });
        if (!record || isTerminalStatus(record.status)) {
            return;
        }
        this.appendStatusEvent(
            record,
            record.status,
            this.truncateText(`自动轮询队列入队失败: ${message}`, 500),
            "system",
        );
        await this.generationRepository.save(record);
    }

    private async notifyTerminalStatus(record: VideoGeneration) {
        if (!isTerminalStatus(record.status)) return;

        const succeeded = record.status === VideoGenerationStatus.SUCCEEDED;
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
            if (isTerminalStatus(locked.status)) {
                return locked;
            }

            locked.status = record.status;
            locked.billingStatus = record.billingStatus;
            locked.taskId = record.taskId;
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
        source: "web" | "console" | "provider" | "webhook" | "system" = "system",
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
        source: "web" | "console" | "provider" | "webhook" | "system" = "system",
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

            const result = JSON.parse(text) as Record<string, unknown>;
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
    AccountLog,
    File,
    AiModel,
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

function isSuccessStatus(status: string): boolean {
    return ["succeeded", "success", "SUCCEEDED", "completed", "complete"].includes(status);
}

function isFailedStatus(status: string): boolean {
    return ["failed", "cancelled", "canceled", "FAILED", "CANCELED", "error"].includes(status);
}

function isTerminalStatus(status: string): boolean {
    return isSuccessStatus(status) || isFailedStatus(status);
}
