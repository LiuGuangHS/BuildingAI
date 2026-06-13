import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core";
import { ExtensionBillingService, PublicAiModelService } from "@buildingai/extension-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, AiProvider, Secret, SecretTemplate } from "@buildingai/db/entities";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Between, In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

import {
    HappyHorseModel,
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
import {
    HappyHorseClient,
    isFailedStatus,
    isSuccessStatus,
    isTerminalStatus,
} from "./happyhorse-client";
import { ModelConfigService, type ResolvedVideoModelConfig } from "./model-config.service";
import { PolicyService } from "./policy.service";
import { PromptOptimizationService } from "./prompt-optimization.service";
import { ProviderConfigService } from "./provider-config.service";
import { ProviderRegistryService } from "./provider-registry.service";
import { TemplateService } from "./template.service";

@Injectable()
export class GenerationService extends BaseService<VideoGeneration> {
    protected readonly logger = new Logger(GenerationService.name);

    constructor(
        @InjectRepository(VideoGeneration)
        private readonly generationRepository: Repository<VideoGeneration>,
        private readonly billingService: ExtensionBillingService,
        private readonly providerConfigService: ProviderConfigService,
        private readonly modelConfigService: ModelConfigService,
        private readonly billingRuleService: BillingRuleService,
        private readonly policyService: PolicyService,
        private readonly providerRegistryService: ProviderRegistryService,
    ) {
        super(generationRepository);
    }

    /** Return admin-enabled model options for web/console selectors. */
    async listModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    /**
     * Submit a video generation task to HappyHorse.
     *
     * Flow:
     * 1. Validate input
     * 2. Create DB record (status = PROCESSING)
     * 3. Submit to HappyHorse
     * 4. Save taskId
     * 5. Return record
     */
    async createAndSubmit(dto: CreateVideoGenerationDto, userId: string) {
        const modelConfig = await this.modelConfigService.findEnabledByModel(dto.model);
        this.assertHappyHorseCompatible(modelConfig);
        const model = modelConfig.model as HappyHorseModel;
        const prompt = this.sanitizeText(dto.prompt, 4000);
        const media = dto.media ?? [];
        await this.policyService.validateGeneration(userId, modelConfig.id, dto);
        this.validateMediaForModel(model, media);
        this.validateParamsForModelConfig(modelConfig, dto);
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

        const runtimeConfig = await this.providerConfigService.getHappyHorseRuntimeConfig();
        const client = this.createProviderClient(modelConfig.provider, runtimeConfig);

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
                    "任务已创建，等待提交到 HappyHorse",
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
                await this.billingService.deductUserPower({
                    userId,
                    amount: billingAmount,
                    remark: `Echoflow Video: ${model}`,
                    associationNo: saved.id,
                    associationUserId: userId,
                }, manager);
                saved.billingStatus = VideoGenerationBillingStatus.DEDUCTED;
                return manager.save(VideoGeneration, saved);
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

        // Submit to HappyHorse
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
            this.appendStatusEvent(saved, VideoGenerationStatus.PROCESSING, "任务已提交到 HappyHorse", "provider");
            await this.generationRepository.save(saved);

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
     * Poll HappyHorse for the current task status and update the DB record.
     * Returns the updated record. If the task has reached a terminal state
     * (succeeded/failed), the record is finalized.
     */
    async pollAndUpdate(id: string, userId: string) {
        const record = await this.findOwnedById(id, userId);
        return this.pollRecord(record, userId);
    }

    async pollAnyAndUpdate(id: string) {
        const record = await this.findOne(id);
        return this.pollRecord(record, record.userId);
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

    /** Health check: verify DB connectivity and HappyHorse availability. */
    async healthCheck() {
        const providerConfig = await this.providerConfigService.getConsoleConfig();
        const activeTasks = await this.generationRepository.count({
            where: {
                status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
            } as FindOptionsWhere<VideoGeneration>,
        });
        const enabledModels = await this.modelConfigService.listEnabledForWeb();
        const modelCompleteness = await this.modelConfigService.getConfigCompleteness();
        const recentFailureStats = await this.getRecentFailureStats();
        let happyhorseStatus = providerConfig.configured
            ? providerConfig.enabled
                ? "unknown"
                : "disabled"
            : "unconfigured";

        try {
            if (providerConfig.configured && providerConfig.enabled) {
                const runtimeConfig = await this.providerConfigService.getHappyHorseRuntimeConfig();
                const client = this.createProviderClient("happyhorse", runtimeConfig);
                await client.testConnection();
                happyhorseStatus = "healthy";
            }
        } catch {
            happyhorseStatus = "unavailable";
        }

        return {
            status: happyhorseStatus === "healthy" ? "ok" : "attention",
            happyhorse: happyhorseStatus,
            provider: {
                configured: providerConfig.configured,
                enabled: providerConfig.enabled,
                baseUrl: providerConfig.baseUrl,
                requestTimeoutMs: providerConfig.requestTimeoutMs,
                maxRetries: providerConfig.maxRetries,
                webhookSecretConfigured: providerConfig.webhookSecretConfigured,
            },
            enabledModelCount: enabledModels.length,
            modelCompleteness,
            activeTasks,
            recentFailures: recentFailureStats,
            checkedAt: new Date().toISOString(),
        };
    }

    private async pollRecord(record: VideoGeneration, userId: string) {
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
            await this.generationRepository.save(record);
            return record;
        }

        const runtimeConfig = await this.providerConfigService.getHappyHorseRuntimeConfig();
        const client = this.createProviderClient(record.provider ?? "happyhorse", runtimeConfig);

        try {
            const pollResult = await client.pollTask(record.taskId);

            // Update raw response on every poll for debugging
            record.rawResponse = this.compactRawPayload(pollResult.rawResponse);

            if (isSuccessStatus(pollResult.status)) {
                record.status = VideoGenerationStatus.SUCCEEDED;
                record.videoUrl = pollResult.videoUrl;
                record.progress = 100;
                record.completedAt = new Date();
                this.appendStatusEvent(record, VideoGenerationStatus.SUCCEEDED, "视频生成完成", "provider");
            } else if (isFailedStatus(pollResult.status)) {
                record.status = VideoGenerationStatus.FAILED;
                record.errorMessage = `HappyHorse 任务失败: status=${pollResult.status}`;
                record.failureCategory = "provider_failed";
                record.progress = 100;
                record.completedAt = new Date();
                this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "provider");
                await this.refundIfNeeded(record, userId, "视频生成失败自动退款");
            } else {
                record.progress = Math.max(record.progress ?? 20, 35);
            }
            // else: still processing, keep status as-is

            await this.generationRepository.save(record);
            return record;
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

    /** Admin: find any record by id (no user check). */
    async findOne(id: string) {
        const generation = await this.generationRepository.findOne({ where: { id } as FindOptionsWhere<VideoGeneration> });
        if (!generation) {
            throw HttpErrorFactory.notFound("视频生成记录不存在");
        }
        return generation;
    }

    /** Admin: delete any record by id (no user check). */
    async deleteOne(id: string) {
        await this.findOne(id);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async updateAdminRemark(id: string, adminRemark: string) {
        const record = await this.findOne(id);
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
        const record = await this.findOne(id);
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
        await this.generationRepository.save(record);
        return record;
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
            updated.push(await this.generationRepository.save(record));
        }
        return { total: records.length, updated };
    }

    async cancelRecord(id: string, message = "管理员取消任务") {
        const record = await this.findOne(id);
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
        return this.generationRepository.save(record);
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
        const record = await this.findOne(id);
        if (record.status !== VideoGenerationStatus.FAILED) {
            throw HttpErrorFactory.badRequest("只有失败任务可以重试");
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

    async deleteOwnedById(id: string, userId: string) {
        await this.findOwnedById(id, userId);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    /** Find a generation record by HappyHorse taskId. */
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
            record.status = VideoGenerationStatus.SUCCEEDED;
            record.videoUrl = videoUrl;
            record.progress = 100;
            record.completedAt = new Date();
            this.appendStatusEvent(record, VideoGenerationStatus.SUCCEEDED, "HappyHorse 回调成功", "webhook");
        } else if (isFailedStatus(status)) {
            record.status = VideoGenerationStatus.FAILED;
            record.errorMessage = `HappyHorse 回调: status=${status}`;
            record.failureCategory = "provider_webhook_failed";
            record.progress = 100;
            record.completedAt = new Date();
            this.appendStatusEvent(record, VideoGenerationStatus.FAILED, record.errorMessage, "webhook");
            await this.refundIfNeeded(record, record.userId, "视频生成失败自动退款");
        }

        await this.generationRepository.save(record);
        this.logger.log(`Webhook processed: taskId=${taskId} status=${record.status}`);
        return record;
    }

    private validateMediaForModel(model: HappyHorseModel, media: VideoMediaItem[]) {
        for (const item of media) {
            this.validateMediaUrl(item);
            this.validateMediaMimeType(item);
        }

        const firstFrames = media.filter((item) => item.type === "first_frame");
        const references = media.filter((item) => item.type === "reference_image");
        const videos = media.filter((item) => item.type === "video");

        switch (model) {
            case HappyHorseModel.T2V:
                if (media.length > 0) {
                    throw HttpErrorFactory.badRequest("文生视频模型不需要媒体素材");
                }
                return;
            case HappyHorseModel.I2V:
                if (firstFrames.length !== 1 || references.length > 0 || videos.length > 0) {
                    throw HttpErrorFactory.badRequest("图生视频模型必须且只能提交 1 张首帧图片");
                }
                return;
            case HappyHorseModel.R2V:
                if (references.length < 1 || references.length > 4 || firstFrames.length > 0 || videos.length > 0) {
                    throw HttpErrorFactory.badRequest("参考图生视频模型必须提交 1-4 张参考图");
                }
                return;
            case HappyHorseModel.VIDEO_EDIT:
                if (videos.length !== 1 || firstFrames.length > 0 || references.length > 4) {
                    throw HttpErrorFactory.badRequest("视频编辑模型必须提交 1 个视频，可选 0-4 张参考图");
                }
                return;
            default:
                throw HttpErrorFactory.badRequest("不支持的视频模型");
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

        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        const isLocalOrPrivate =
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
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
        const isPlatformUpload =
            Boolean(item.fileId) &&
            (url.pathname.startsWith("/echoflow-video/uploads/") ||
                url.pathname.startsWith("/uploads/"));

        if (isLocalOrPrivate && !isPlatformUpload) {
            throw HttpErrorFactory.badRequest("媒体素材 URL 不允许指向本机或内网地址");
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
        if (
            record.billingStatus !== VideoGenerationBillingStatus.DEDUCTED ||
            !record.billingAmount ||
            record.billingAmount <= 0 ||
            record.billingRuleSnapshot?.refundOnFailure === false
        ) {
            return;
        }

        try {
            await this.withTransaction(async (manager) => {
                await this.billingService.addUserPower({
                    userId,
                    amount: record.billingAmount,
                    remark,
                    associationNo: record.id,
                    associationUserId: userId,
                }, manager);
                record.billingStatus = VideoGenerationBillingStatus.REFUNDED;
                await manager.save(VideoGeneration, record);
            });
        } catch (error) {
            this.logger.error(`Video generation ${record.id} billing refund failed`, error);
            record.errorMessage = this.truncateText(
                `${record.errorMessage || "任务失败"}（退款失败，请联系管理员）`,
                2000,
            );
        }
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

    private assertHappyHorseCompatible(modelConfig: ResolvedVideoModelConfig) {
        if (modelConfig.provider !== "happyhorse") {
            throw HttpErrorFactory.badRequest(
                `视频供应商 ${modelConfig.provider} 尚未接入提交适配器`,
            );
        }
        if (!Object.values(HappyHorseModel).includes(modelConfig.model as HappyHorseModel)) {
            throw HttpErrorFactory.badRequest(`HappyHorse 模型 ${modelConfig.model} 暂不支持`);
        }
    }

    private createProviderClient(providerId: string, runtimeConfig: {
        apiKey: string;
        clientOptions: Record<string, unknown>;
    }) {
        const adapter = this.providerRegistryService.getAdapter(providerId);
        if (!adapter?.enabled) {
            throw HttpErrorFactory.badRequest(`视频供应商 ${providerId} 尚未启用`);
        }
        return adapter.createClient(runtimeConfig);
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
    AiModel,
    AiProvider,
    Secret,
    SecretTemplate,
];
export const generationModuleProviders = [
    GenerationService,
    ProviderConfigService,
    ModelConfigService,
    BillingRuleService,
    TemplateService,
    PolicyService,
    PromptOptimizationService,
    PublicAiModelService,
    SecretService,
    ProviderRegistryService,
];
