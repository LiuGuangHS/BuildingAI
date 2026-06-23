import { BaseService } from "@buildingai/base";
import { ACTION } from "@buildingai/constants";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Brackets, EntityManager, In, LessThan, Repository } from "@buildingai/db/typeorm";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    Output,
    PublicAiModelService,
} from "@buildingai/extension-sdk";
import { HttpErrorFactory } from "@buildingai/errors";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";

import { AstrologyFortuneSetting, AstrologyProfile, AstrologyReport, AstrologyReportStatus, AstrologyReportType, type AstrologyReportResult } from "../../../db/entities";
import { CreateAstrologyProfileDto, GenerateAstrologyReportDto, QueryAstrologyProfileDto, QueryAstrologyReportDto, UpdateAstrologyFortuneSettingDto, UpdateAstrologyProfileDto, UpdateReportFeedbackDto } from "../dto";
import { ASTROLOGY_REPORT_JOB, ASTROLOGY_REPORT_QUEUE } from "./astrology-queue.constants";
import { normalizeAstrologyReportAiResult, parseAstrologyReportAiResult } from "./astrology-report-ai-result";
import { generateAstrologyReportAiResultWithRepair } from "./astrology-report-ai-retry";
import { buildAstrologyReportFailure } from "./astrology-report-failure";
import { buildAstrologyReportFeedbackMetadata } from "./astrology-report-feedback";
import { buildAstrologyReportGenerationContext } from "./astrology-report-public-metadata";
import { buildAstrologyReportText } from "./astrology-report-text";
import {
    buildAstrologyQuestionQualityContext,
    summarizeAstrologyQuestionQuality,
    type AstrologyQuestionQualityContext,
} from "./astrology-question-quality";
import {
    ASTROLOGY_REPORT_BUSY_STATUSES,
    ASTROLOGY_REPORT_STALE_PROCESSING_MS,
    canClaimAstrologyReportForProcessing,
    canRecoverAstrologyReport,
    isAstrologyReportBusyStatus,
} from "./astrology-report-recovery-rules";
import {
    ASTROLOGY_FORTUNE_EXTENSION_ID,
    ASTROLOGY_REPORT_FAILED_SCENE,
    ASTROLOGY_REPORT_LINK_URL,
    ASTROLOGY_REPORT_SUCCEEDED_SCENE,
    buildAstrologyReportFailedNotification,
    buildAstrologyReportSucceededNotification,
} from "./astrology-report-notification-rules";

const DEFAULT_PAGE_SIZE = 20;
const MAX_TARGET_PROFILE_KEYS = 20;
const MAX_TARGET_PROFILE_CHARS = 2000;
const CHINESE_ZODIACS = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];
const SETTING_KEY = "default";

type AstrologySourceReportPromptContext = {
    id: string;
    reportType: AstrologyReportType;
    title?: string | null;
    summary?: string | null;
    question?: string | null;
    evidence?: Array<{ source: string; insight: string; confidence: "low" | "medium" | "high" }>;
    actions?: Array<string | { item: string; reason?: string; timebox?: string }>;
    warnings?: Array<string | { title: string; detail?: string }>;
    reviewChecklist?: Array<{ item: string; why: string; evidenceSource: string; timebox?: string }>;
    feedback?: {
        rating?: string;
        note?: string;
    };
};
type PublicAiModelInfo = NonNullable<Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>>;

type AstrologyReportPromptPayload = GenerateAstrologyReportDto & {
    sourceReportContext?: AstrologySourceReportPromptContext;
    questionQuality?: AstrologyQuestionQualityContext;
};

@Injectable()
export class AstrologyFortuneService extends BaseService<AstrologyReport> implements OnModuleInit {
    protected readonly logger = new Logger(AstrologyFortuneService.name);

    constructor(
        @InjectRepository(AstrologyReport)
        private readonly reportRepo: Repository<AstrologyReport>,
        @InjectRepository(AstrologyProfile)
        private readonly profileRepo: Repository<AstrologyProfile>,
        @InjectRepository(AstrologyFortuneSetting)
        private readonly settingRepo: Repository<AstrologyFortuneSetting>,
        private readonly billingService: ExtensionBillingService,
        private readonly publicAiModelService: PublicAiModelService,
        private readonly notificationService: ExtensionNotificationService,
        @InjectQueue(ASTROLOGY_REPORT_QUEUE)
        private readonly reportQueue: Queue,
    ) {
        super(reportRepo);
    }

    async onModuleInit() {
        await this.registerNotificationScenes();
        await this.recoverInterruptedReports();
        await this.failStaleReports("服务重启后任务超时未完成，请重新生成报告");
    }

    private async registerNotificationScenes() {
        await this.notificationService.registerScenes(ASTROLOGY_FORTUNE_EXTENSION_ID, [
            {
                sceneCode: ASTROLOGY_REPORT_SUCCEEDED_SCENE,
                name: "星盘报告生成完成",
                description: "用户发起的星盘运势报告生成成功。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "星盘报告已完成",
                contentTemplate: "{{taskName}} 已生成，可前往查看报告。",
                linkUrlTemplate: ASTROLOGY_REPORT_LINK_URL,
            },
            {
                sceneCode: ASTROLOGY_REPORT_FAILED_SCENE,
                name: "星盘报告生成失败",
                description: "用户发起的星盘运势报告生成失败。",
                level: "error",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "星盘报告生成失败",
                contentTemplate: "{{taskName}} 处理失败，{{reason}}",
                linkUrlTemplate: ASTROLOGY_REPORT_LINK_URL,
            },
        ]);
    }

    async createProfile(userId: string, dto: CreateAstrologyProfileDto) {
        return this.profileRepo.save(this.buildProfile({ ...dto, userId }));
    }

    async updateProfile(userId: string, profileId: string, dto: UpdateAstrologyProfileDto) {
        const profile = await this.getProfileDetail(userId, profileId);
        const { metadata: _metadata, ...profileUpdate } = this.buildProfile({
            userId,
            name: dto.name ?? profile.name,
            gender: dto.gender ?? profile.gender ?? undefined,
            birthDate: dto.birthDate ?? profile.birthDate,
            birthTime: dto.birthTime ?? profile.birthTime ?? undefined,
            birthPlace: dto.birthPlace ?? profile.birthPlace ?? undefined,
            zodiacSign: dto.zodiacSign ?? profile.zodiacSign,
            moonSign: dto.moonSign ?? profile.moonSign ?? undefined,
            risingSign: dto.risingSign ?? profile.risingSign ?? undefined,
        });
        await this.profileRepo.update(profile.id, {
            ...profileUpdate,
            personalitySnapshot: profile.personalitySnapshot,
        });
        return this.getProfileDetail(userId, profile.id);
    }

    async listUserProfiles(userId: string, query: QueryAstrologyProfileDto) {
        return this.listProfiles({ ...query, userId });
    }

    async getProfileDetail(userId: string, profileId: string) {
        const profile = await this.profileRepo.findOne({ where: { id: profileId, userId } });
        if (!profile) throw HttpErrorFactory.notFound("星盘档案不存在");
        return profile;
    }

    async deleteProfile(userId: string, profileId: string) {
        const profile = await this.getProfileDetail(userId, profileId);
        await this.assertProfileNotUsedByBusyReport(userId, profile.id);
        await this.profileRepo.softDelete({ id: profile.id, userId });
        return { success: true };
    }

    async generateReport(userId: string, dto: GenerateAstrologyReportDto) {
        const setting = await this.getSetting();
        const model = await this.loadConfiguredModel(setting.defaultModelId);
        const cost = this.calculateCost(setting, dto.reportType);
        const normalizedDto = { ...dto, targetProfile: this.normalizeTargetProfile(dto.targetProfile) };

        if (cost > 0 && !(await this.billingService.hasSufficientPower(userId, cost))) {
            throw HttpErrorFactory.badRequest("积分不足");
        }

        const profile = await this.resolveProfile(userId, dto);
        const sourceReport = normalizedDto.sourceReportId ? await this.resolveSourceReport(userId, normalizedDto.sourceReportId) : null;
        const questionQuality = buildAstrologyQuestionQualityContext(normalizedDto);
        const promptPayload: AstrologyReportPromptPayload = {
            ...normalizedDto,
            questionQuality,
            ...(sourceReport ? { sourceReportContext: this.buildSourceReportPromptContext(sourceReport) } : {}),
        };

        const report = await this.create({
            userId,
            profileId: profile?.id ?? null,
            modelId: model.id,
            providerId: model.provider.id,
            reportType: dto.reportType,
            question: normalizedDto.question ?? null,
            targetProfile: normalizedDto.targetProfile ?? null,
            status: AstrologyReportStatus.PENDING,
            result: null,
            resultText: null,
            score: null,
            tags: this.buildTags(normalizedDto, profile),
            isFavorite: false,
            costCredits: cost,
            errorMessage: null,
            providerMetadata: {
                requestedAt: new Date().toISOString(),
                generationContext: buildAstrologyReportGenerationContext(normalizedDto, questionQuality),
                ...(sourceReport
                    ? {
                          sourceReport: {
                              id: sourceReport.id,
                              reportType: sourceReport.reportType,
                              title: sourceReport.result?.title || sourceReport.question || null,
                          },
                      }
                    : {}),
            },
            requestPayload: promptPayload as unknown as Record<string, unknown>,
        } as Partial<AstrologyReport>);

        await this.enqueueReportJob(report.id);

        return report;
    }

    async executeReportJob(reportId: string) {
        const report = await this.reportRepo.findOne({ where: { id: reportId } });
        if (!report) return null;
        if (!isAstrologyReportBusyStatus(report.status)) return report;
        if (!report.requestPayload) {
            await this.markReportFailedIfActive(report.id, "报告请求载荷缺失，请重新生成");
            return this.reportRepo.findOne({ where: { id: report.id } });
        }
        return this.processReport(report.id, report.requestPayload as unknown as AstrologyReportPromptPayload, report.profileId ?? null);
    }

    private async processReport(reportId: string, dto: AstrologyReportPromptPayload, profileId: string | null) {
        const report = await this.claimReportForProcessing(reportId);
        if (!report) return null;

        try {
            const model = await this.loadModel(report.modelId, "AI星盘运势默认模型不可用，请管理员重新配置");
            const profile = profileId ? await this.profileRepo.findOne({ where: { id: profileId, userId: report.userId } }) : null;
            await this.reserveReportCreditsOnce(report, model.name);
            const aiGeneration = await generateAstrologyReportAiResultWithRepair({
                basePrompt: this.buildPrompt(dto, profile),
                generate: (prompt) =>
                    this.publicAiModelService.generateText(model.id, {
                        prompt,
                        temperature: 0.55,
                    }),
                parse: parseAstrologyReportAiResult,
            });
            const normalized = normalizeAstrologyReportAiResult(aiGeneration.result);
            const resultText = buildAstrologyReportText(normalized);
            const score = this.extractOverallScore(normalized);

            const savedReport = await this.reportRepo.manager.transaction(async (entityManager) => {
                const currentReport = await this.findActiveReportForWrite(report.id, entityManager);
                if (!currentReport) return null;
                if (!isAstrologyReportBusyStatus(currentReport.status)) return currentReport;
                await entityManager.update(AstrologyReport, report.id, {
                    status: AstrologyReportStatus.SUCCESS,
                    result: normalized,
                    resultText,
                    score,
                    errorMessage: null,
                    providerMetadata: {
                        ...(currentReport.providerMetadata ?? {}),
                        provider: model.provider.provider,
                        model: model.model,
                        ...aiGeneration.metadata,
                    },
                });

                if ((dto.reportType === AstrologyReportType.PROFILE || dto.reportType === AstrologyReportType.PERSONALITY) && profile?.id) {
                    const currentProfile = await entityManager.findOne(AstrologyProfile, { where: { id: profile.id, userId: report.userId }, withDeleted: true });
                    if (!currentProfile || currentProfile.deletedAt) return (await entityManager.findOne(AstrologyReport, { where: { id: report.id } })) as AstrologyReport;
                    await entityManager.update(AstrologyProfile, currentProfile.id, {
                        personalitySnapshot: {
                            summary: normalized.summary,
                            keywords: normalized.keywords ?? [],
                            strengths: (normalized.actions ?? []).map(formatReportActionItem),
                            challenges: (normalized.warnings ?? []).map(formatReportWarningItem),
                        },
                    });
                }

                return (await entityManager.findOne(AstrologyReport, { where: { id: report.id } })) as AstrologyReport;
            });
            await this.notifyReportSucceeded(savedReport);
            return savedReport;
        } catch (error) {
            const failure = buildAstrologyReportFailure(error);
            this.logger.error(`Astrology report ${report.id} failed: ${failure.metadata.failureReason}`);
            await this.refundReportCreditsIfNeeded(report.id, "AI星盘运势生成失败自动退款");
            await this.markReportFailedIfActive(report.id, failure.message, failure.metadata);
            return this.reportRepo.findOne({ where: { id: report.id } });
        }
    }

    async listUserReports(userId: string, query: QueryAstrologyReportDto) {
        return this.listReports({ ...query, userId });
    }

    async getReportDetail(userId: string, reportId: string) {
        const report = await this.reportRepo.findOne({ where: { id: reportId, userId } });
        if (!report) throw HttpErrorFactory.notFound("星盘报告不存在");
        return report;
    }

    private async resolveSourceReport(userId: string, reportId: string) {
        const report = await this.reportRepo.findOne({ where: { id: reportId, userId } });
        if (!report) throw HttpErrorFactory.notFound("来源报告不存在");
        if (report.status !== AstrologyReportStatus.SUCCESS || !report.result) throw HttpErrorFactory.badRequest("只能基于已完成报告继续追问");
        return report;
    }

    async updateFavorite(userId: string, reportId: string, isFavorite: boolean) {
        const report = await this.getReportDetail(userId, reportId);
        await this.reportRepo.update(report.id, { isFavorite });
        return this.getReportDetail(userId, report.id);
    }

    async updateReportFeedback(userId: string, reportId: string, dto: UpdateReportFeedbackDto) {
        const report = await this.getReportDetail(userId, reportId);
        if (report.status !== AstrologyReportStatus.SUCCESS || !report.result) {
            throw HttpErrorFactory.badRequest("只能评价已完成的报告");
        }
        await this.reportRepo.update(report.id, {
            providerMetadata: buildAstrologyReportFeedbackMetadata(report.providerMetadata, dto),
        });
        return this.getReportDetail(userId, report.id);
    }

    async deleteReport(userId: string, reportId: string) {
        const report = await this.getReportDetail(userId, reportId);
        this.assertReportNotBusy(report);
        await this.reportRepo.softDelete({ id: reportId, userId });
        return { success: true };
    }

    async getAllProfiles(query: QueryAstrologyProfileDto) {
        return this.listProfiles(query);
    }

    async getAllReports(query: QueryAstrologyReportDto) {
        return this.listReports(query);
    }

    async getReportStats(query: QueryAstrologyReportDto) {
        const qb = this.applyReportFilters(this.reportRepo.createQueryBuilder("report"), query);
        const raw = await qb
            .select("COUNT(report.id)", "total")
            .addSelect("SUM(CASE WHEN report.status = :success THEN 1 ELSE 0 END)", "success")
            .addSelect("SUM(CASE WHEN report.status = :failed THEN 1 ELSE 0 END)", "failed")
            .addSelect("SUM(CASE WHEN report.status = :pending THEN 1 ELSE 0 END)", "pending")
            .addSelect("SUM(CASE WHEN report.status = :processing THEN 1 ELSE 0 END)", "processing")
            .addSelect("SUM(CASE WHEN report.isFavorite = true THEN 1 ELSE 0 END)", "favorite")
            .setParameters({
                success: AstrologyReportStatus.SUCCESS,
                failed: AstrologyReportStatus.FAILED,
                pending: AstrologyReportStatus.PENDING,
                processing: AstrologyReportStatus.PROCESSING,
            })
            .getRawOne<{ total?: string; success?: string; failed?: string; pending?: string; processing?: string; favorite?: string }>();

        const pending = this.toCount(raw?.pending);
        const processing = this.toCount(raw?.processing);
        return {
            total: this.toCount(raw?.total),
            success: this.toCount(raw?.success),
            failed: this.toCount(raw?.failed),
            pending,
            processing,
            busy: pending + processing,
            favorite: this.toCount(raw?.favorite),
        };
    }

    async getAdminReportDetail(reportId: string) {
        const report = await this.reportRepo.findOne({ where: { id: reportId } });
        if (!report) throw HttpErrorFactory.notFound("星盘报告不存在");
        return report;
    }

    async adminDeleteReport(reportId: string) {
        const report = await this.getAdminReportDetail(reportId);
        this.assertReportNotBusy(report);
        await this.reportRepo.softDelete(reportId);
        return { success: true };
    }

    async getSetting() {
        const existing = await this.settingRepo.findOne({ where: { key: SETTING_KEY } });
        if (existing) return existing;
        try {
            return await this.settingRepo.save({ key: SETTING_KEY, dailyPrice: 0, reportPrice: 0, compatibilityPrice: 0, decisionPrice: 0, metadata: {} });
        } catch (error) {
            if ((error as { code?: string }).code !== "23505") throw error;
            const racedSetting = await this.settingRepo.findOne({ where: { key: SETTING_KEY } });
            if (racedSetting) return racedSetting;
            throw error;
        }
    }

    async getPublicGenerationStatus() {
        const setting = await this.getSetting();
        const prices = {
            daily: Number(setting.dailyPrice ?? 0),
            report: Number(setting.reportPrice ?? 0),
            compatibility: Number(setting.compatibilityPrice ?? 0),
            decision: Number(setting.decisionPrice ?? 0),
        };
        const modelId = this.getConfiguredModelId(setting);
        const model = modelId ? await this.getModelInfo(modelId) : null;
        const canGenerate = Boolean(model?.provider?.isActive && model.modelType === "llm");

        return {
            canGenerate,
            unavailableReason: canGenerate ? null : "当前生成服务暂不可用，请稍后再试。",
            prices,
        };
    }

    async cleanupStaleReports() {
        return this.failStaleReports("报告生成超时，请重新生成");
    }

    private async recoverInterruptedReports() {
        const cutoff = new Date(Date.now() - ASTROLOGY_REPORT_STALE_PROCESSING_MS);
        try {
            const reports = await this.reportRepo.find({
                where: {
                    status: In(ASTROLOGY_REPORT_BUSY_STATUSES),
                    updatedAt: LessThan(cutoff),
                },
                order: { updatedAt: "ASC" },
                take: 50,
            });
            let recoveredCount = 0;
            for (const report of reports) {
                const claimedReport = await this.claimReportForRecovery(report.id, cutoff);
                if (!claimedReport?.requestPayload) continue;
                recoveredCount += 1;
                await this.enqueueReportJob(claimedReport.id);
            }
            if (recoveredCount) this.logger.warn(`Recovered ${recoveredCount} interrupted astrology report(s)`);
            return { affected: recoveredCount };
        } catch (error) {
            if ((error as { code?: string }).code === "42P01") {
                this.logger.warn("Astrology report table does not exist yet, skipping interrupted report recovery");
                return { affected: 0 };
            }
            throw error;
        }
    }

    private async claimReportForRecovery(reportId: string, cutoff: Date) {
        return this.reportRepo.manager.transaction(async (entityManager) => {
            const report = await entityManager.findOne(AstrologyReport, { where: { id: reportId }, lock: { mode: "pessimistic_write" }, withDeleted: true });
            if (!canRecoverAstrologyReport(report, cutoff, Date.now())) return null;
            const metadata = report.providerMetadata ?? {};
            const now = new Date().toISOString();
            const providerMetadata = {
                ...metadata,
                recoveredAt: now,
                recoveryLockedAt: now,
            };
            await entityManager.update(AstrologyReport, report.id, {
                status: AstrologyReportStatus.PENDING,
                providerMetadata,
            });
            return {
                ...report,
                status: AstrologyReportStatus.PENDING,
                providerMetadata,
            };
        });
    }

    private async claimReportForProcessing(reportId: string) {
        return this.reportRepo.manager.transaction(async (entityManager) => {
            const report = await entityManager.findOne(AstrologyReport, {
                where: { id: reportId },
                lock: { mode: "pessimistic_write" },
                withDeleted: true,
            });
            if (!canClaimAstrologyReportForProcessing(report, Date.now())) return null;

            const metadata = report.providerMetadata ?? {};
            const providerMetadata = {
                ...metadata,
                processingLockedAt: new Date().toISOString(),
            };
            await entityManager.update(AstrologyReport, report.id, {
                status: AstrologyReportStatus.PROCESSING,
                providerMetadata,
            });

            return {
                ...report,
                status: AstrologyReportStatus.PROCESSING,
                providerMetadata,
            };
        });
    }

    private async enqueueReportJob(id: string) {
        try {
            await this.reportQueue.add(
                ASTROLOGY_REPORT_JOB,
                { id },
                {
                    jobId: `astrology-report-${id}-${Date.now()}`,
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Queue astrology report ${id} failed: ${message}`, error);
            await this.markReportCrashed(id, new Error("AI星盘运势任务队列暂不可用，请稍后重试"), {
                failureType: "queue_enqueue_failed",
                failureReason: message,
            });
            throw HttpErrorFactory.badRequest("AI星盘运势任务队列暂不可用，请稍后重试");
        }
    }

    private async failStaleReports(message: string) {
        const cutoff = new Date(Date.now() - ASTROLOGY_REPORT_STALE_PROCESSING_MS);
        let result;
        try {
            const staleReports = await this.reportRepo.find({
                where: { status: In(ASTROLOGY_REPORT_BUSY_STATUSES), updatedAt: LessThan(cutoff) },
                take: 100,
            });
            for (const report of staleReports) {
                await this.refundReportCreditsIfNeeded(report.id, message);
                await this.markReportFailedIfActive(report.id, message, {
                    failureType: "stale_report_timeout",
                    failureReason: message,
                });
            }
            result = { affected: staleReports.length };
        } catch (error) {
            if ((error as { code?: string }).code === "42P01") {
                this.logger.warn("Astrology report table does not exist yet, skipping stale report cleanup");
                return { affected: 0 };
            }
            throw error;
        }
        if (result.affected) this.logger.warn(`Marked ${result.affected} stale astrology report(s) as failed`);
        return { affected: result.affected ?? 0 };
    }

    async updateSetting(dto: UpdateAstrologyFortuneSettingDto) {
        const setting = await this.getSetting();
        const updatePayload: {
            defaultModelId?: string | null;
            dailyPrice: number;
            reportPrice: number;
            compatibilityPrice: number;
            decisionPrice: number;
        } = {
            dailyPrice: dto.dailyPrice ?? setting.dailyPrice,
            reportPrice: dto.reportPrice ?? setting.reportPrice,
            compatibilityPrice: dto.compatibilityPrice ?? setting.compatibilityPrice,
            decisionPrice: dto.decisionPrice ?? setting.decisionPrice,
        };

        if (Object.hasOwn(dto, "defaultModelId")) {
            const defaultModelId = this.toOptionalString(dto.defaultModelId) || null;
            if (defaultModelId) await this.loadModel(defaultModelId, "AI星盘运势默认模型不可用，请重新选择");
            updatePayload.defaultModelId = defaultModelId;
        }

        await this.settingRepo.update(setting.id, updatePayload);
        return this.getSetting();
    }

    private buildProfile(input: Partial<CreateAstrologyProfileDto> & { userId: string }) {
        const name = this.toOptionalString(input.name);
        const birthDate = this.toOptionalString(input.birthDate);
        if (!name) throw HttpErrorFactory.badRequest("请填写档案名称");
        if (!birthDate) throw HttpErrorFactory.badRequest("请填写出生日期");

        return {
            userId: input.userId,
            name,
            gender: this.toOptionalString(input.gender),
            birthDate,
            birthTime: this.toOptionalString(input.birthTime),
            birthPlace: this.toOptionalString(input.birthPlace),
            zodiacSign: this.toOptionalString(input.zodiacSign) || this.getZodiacSign(birthDate),
            moonSign: this.toOptionalString(input.moonSign),
            risingSign: this.toOptionalString(input.risingSign),
            chineseZodiac: this.getChineseZodiac(birthDate),
            personalitySnapshot: {},
            metadata: {},
        };
    }

    private async resolveProfile(userId: string, dto: GenerateAstrologyReportDto) {
        if (dto.profileId) return this.getProfileDetail(userId, dto.profileId);
        if (!dto.profile) return null;
        if (!this.toOptionalString(dto.profile.birthDate)) throw HttpErrorFactory.badRequest("请提供出生日期或选择星盘档案");
        return this.createProfile(userId, dto.profile as CreateAstrologyProfileDto);
    }

    private async listProfiles(query: QueryAstrologyProfileDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const qb = this.profileRepo.createQueryBuilder("profile").orderBy("profile.createdAt", "DESC");
        if (query.userId) qb.andWhere("profile.userId = :userId", { userId: query.userId });
        if (query.keyword) qb.andWhere("profile.name ILIKE :keyword", { keyword: `%${query.keyword}%` });
        const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    private async listReports(query: QueryAstrologyReportDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const qb = this.applyReportFilters(this.reportRepo.createQueryBuilder("report"), query).orderBy("report.createdAt", "DESC");
        const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    private applyReportFilters(qb: ReturnType<Repository<AstrologyReport>["createQueryBuilder"]>, query: QueryAstrologyReportDto) {
        if (query.userId) qb.andWhere("report.userId = :userId", { userId: query.userId });
        if (query.profileId) qb.andWhere("report.profileId = :profileId", { profileId: query.profileId });
        if (query.status) qb.andWhere("report.status = :status", { status: query.status });
        if (query.reportType) qb.andWhere("report.reportType = :reportType", { reportType: query.reportType });
        if (query.modelId) qb.andWhere("report.modelId = :modelId", { modelId: query.modelId });
        if (query.providerId) qb.andWhere("report.providerId = :providerId", { providerId: query.providerId });
        if (query.isFavorite !== undefined) qb.andWhere("report.isFavorite = :isFavorite", { isFavorite: query.isFavorite });
        if (query.keyword) {
            qb.andWhere(new Brackets((nested) => nested.where("report.question ILIKE :keyword", { keyword: `%${query.keyword}%` }).orWhere("report.resultText ILIKE :keyword", { keyword: `%${query.keyword}%` })));
        }
        return qb;
    }

    private async loadConfiguredModel(modelId?: string | null) {
        if (!modelId) throw HttpErrorFactory.badRequest("AI星盘运势未配置默认模型，请管理员在后台配置");
        return this.loadModel(modelId, "AI星盘运势默认模型不可用，请管理员重新配置");
    }

    private getConfiguredModelId(setting: AstrologyFortuneSetting) {
        return setting.defaultModelId ?? null;
    }

    private async loadModel(modelId: string, errorMessage = "AI 星盘运势需要可用的 LLM 模型") {
        const model = await this.getModelInfo(modelId);
        if (!model || !model.provider || !model.provider.isActive || model.modelType !== "llm") {
            throw HttpErrorFactory.badRequest(errorMessage);
        }
        return model;
    }

    private async getModelInfo(modelId: string): Promise<PublicAiModelInfo | null> {
        try {
            return await this.publicAiModelService.getModelInfo(modelId);
        } catch {
            return null;
        }
    }

    async listAvailableLlmModels() {
        const models = await this.publicAiModelService.listActiveLlmModels();
        return models
            .filter((model) => model.provider?.isActive)
            .map((model) => ({
                id: model.id,
                name: model.name,
                model: model.model,
                modelType: model.modelType,
                providerName: model.provider.name,
                provider: {
                    id: model.provider.id,
                    name: model.provider.name,
                    provider: model.provider.provider,
                    isActive: model.provider.isActive,
                },
            }));
    }

    private async reserveReportCreditsOnce(report: AstrologyReport, modelName: string, entityManager?: EntityManager) {
        const cost = Number(report.costCredits ?? 0);
        if (cost <= 0) return;
        if (!entityManager) {
            return this.reportRepo.manager.transaction((manager) => this.reserveReportCreditsOnce(report, modelName, manager));
        }
        const currentReport = await this.findActiveReportForWrite(report.id, entityManager, true);
        if (!currentReport) return;
        if (currentReport.providerMetadata?.billingStatus === "deducted") return;
        const existingLog = await this.billingService.hasBillingLog({ associationNo: report.id, action: ACTION.DEC }, entityManager);
        if (!existingLog) {
            await this.billingService.deductUserPower({ userId: report.userId, amount: cost, remark: `AI星盘运势: ${modelName}`, associationNo: report.id, associationUserId: report.userId }, entityManager);
        }
        await entityManager.update(AstrologyReport, report.id, {
            providerMetadata: {
                ...(currentReport.providerMetadata ?? report.providerMetadata ?? {}),
                billingStatus: "deducted",
                billedAt: new Date().toISOString(),
            },
        });
    }

    private async refundReportCreditsIfNeeded(reportId: string, remark: string) {
        try {
            await this.reportRepo.manager.transaction(async (entityManager) => {
                const report = await entityManager.findOne(AstrologyReport, { where: { id: reportId }, lock: { mode: "pessimistic_write" }, withDeleted: true });
                if (!report || Number(report.costCredits ?? 0) <= 0) return;
                const metadata = report.providerMetadata ?? {};
                const wasDeducted = metadata.billingStatus === "deducted" || await this.billingService.hasBillingLog({ associationNo: report.id, action: ACTION.DEC }, entityManager);
                const alreadyRefunded = Boolean(metadata.refundedAt) || await this.billingService.hasBillingLog({ associationNo: report.id, action: ACTION.INC }, entityManager);
                if (!wasDeducted || alreadyRefunded) return;
                await this.billingService.addUserPower({ userId: report.userId, amount: Number(report.costCredits), remark, associationNo: report.id, associationUserId: report.userId }, entityManager);
                await entityManager.update(AstrologyReport, report.id, {
                    providerMetadata: {
                        ...metadata,
                        billingStatus: "refunded",
                        refundedAt: new Date().toISOString(),
                        refundRemark: remark,
                    },
                });
            });
        } catch (error) {
            const refundMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Astrology report ${reportId} refund failed: ${refundMessage}`);
            const report = await this.reportRepo.findOne({ where: { id: reportId }, withDeleted: true });
            if (!report) return;
            await this.reportRepo.update(reportId, { providerMetadata: { ...(report.providerMetadata ?? {}), refundError: refundMessage } });
        }
    }

    private async markReportFailedIfActive(reportId: string, message: string, metadata?: Record<string, unknown>) {
        let failedReport: AstrologyReport | null = null;
        await this.reportRepo.manager.transaction(async (entityManager) => {
            const report = await this.findActiveReportForWrite(reportId, entityManager, true);
            if (!report || !isAstrologyReportBusyStatus(report.status)) return;
            const providerMetadata = { ...(report.providerMetadata ?? {}), error: message, ...(metadata ?? {}) };
            await entityManager.update(AstrologyReport, reportId, {
                status: AstrologyReportStatus.FAILED,
                errorMessage: message,
                providerMetadata,
            });
            failedReport = {
                ...report,
                status: AstrologyReportStatus.FAILED,
                errorMessage: message,
                providerMetadata,
            };
        });
        if (failedReport) {
            await this.notifyReportFailed(failedReport, message);
        }
    }

    private async notifyReportSucceeded(report: AstrologyReport | null) {
        if (!report) return;
        await this.notificationService.notifyUser(buildAstrologyReportSucceededNotification(report));
    }

    private async notifyReportFailed(report: AstrologyReport, message: string) {
        await this.notificationService.notifyUser(buildAstrologyReportFailedNotification(report, message));
    }

    async markReportCrashed(reportId: string, error: unknown, metadata?: Record<string, unknown>) {
        const message = error instanceof Error ? error.message : String(error);
        await this.refundReportCreditsIfNeeded(reportId, "AI星盘运势任务异常自动退款");
        await this.markReportFailedIfActive(reportId, message, metadata);
    }

    private assertReportNotBusy(report: AstrologyReport) {
        if (isAstrologyReportBusyStatus(report.status)) {
            throw HttpErrorFactory.badRequest("报告正在生成，暂不能删除");
        }
    }

    private async assertProfileNotUsedByBusyReport(userId: string, profileId: string) {
        const report = await this.reportRepo.findOne({
            where: { userId, profileId, status: In(ASTROLOGY_REPORT_BUSY_STATUSES) },
            select: ["id"],
        });
        if (report) {
            throw HttpErrorFactory.badRequest("该档案仍有报告正在生成，暂不能删除");
        }
    }


    private async findActiveReportForWrite(reportId: string, entityManager?: EntityManager, lockForUpdate = false) {
        const repo = entityManager ?? this.reportRepo.manager;
        const report = await repo.findOne(AstrologyReport, {
            where: { id: reportId },
            withDeleted: true,
            ...(lockForUpdate ? { lock: { mode: "pessimistic_write" as const } } : {}),
        });
        return report && !report.deletedAt ? report : null;
    }

    private buildPrompt(dto: AstrologyReportPromptPayload, profile: AstrologyProfile | null) {
        const profileText = profile
            ? `姓名:${profile.name}\n性别:${profile.gender || "未填写"}\n生日:${profile.birthDate}\n出生时间:${profile.birthTime || "未填写"}\n出生地:${profile.birthPlace || "未填写"}\n太阳星座:${profile.zodiacSign}\n月亮星座:${profile.moonSign || "未填写"}\n上升星座:${profile.risingSign || "未填写"}\n生肖:${profile.chineseZodiac}\n长期画像:${JSON.stringify(profile.personalitySnapshot || {})}`
            : "用户尚未创建长期档案。";
        const sourceReportText = dto.sourceReportContext
            ? `追问来源报告:\n${JSON.stringify(dto.sourceReportContext, null, 2)}`
            : "追问来源报告: 无";
        const questionQualityText = summarizeAstrologyQuestionQuality(
            dto.questionQuality ?? buildAstrologyQuestionQualityContext(dto),
        );

        return `你是 EchoFlowAI 的星盘与生活决策分析师。请结合星座、生肖、出生信息、长期画像、用户问题和现实生活建议生成个性化报告，让用户知道依据、机会、风险和下一步行动。
请避免绝对化断言、医疗/法律/投资保证，不要声称确定预测未来。不得使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺；如果把建议写成确定结果，后端会拒绝本次报告。只输出一个 JSON 对象，不要输出 Markdown、代码块或额外解释。

报告类型: ${dto.reportType}
关注方向: ${dto.focusArea || "综合"}
当前状态: ${dto.currentState || "未填写"}
用户问题: ${dto.question || "无"}
语言: ${dto.language || "zh-CN"}

用户档案:
${profileText}

目标对象/关系对象:
${JSON.stringify(dto.targetProfile || {}, null, 2)}

${sourceReportText}

问题质量:
${questionQualityText}

输出要求:
- JSON 字段必须包含 title、summary、scores、keywords、lucky、evidence、sections、actions、warnings、reviewChecklist、followUps、closing。
- 如果问题质量是 weak，先在 summary 和 sections 中说明还缺哪些信息，再给出保守建议和补充问题；不要编造没有依据的细节。
- title 要有吸引力但不要夸张。
- summary 用 1-2 句话给结论。
- scores 是对象，至少包含 overall，并按报告类型包含 love/career/wealth/mood/social 等 0-100 分数。
- evidence 是 2-5 条判断依据，每项包含 source、insight、confidence；confidence 只能是 low、medium、high；source 必须来自用户档案、当前状态、问题质量、目标对象或追问来源，不要编造未提供的数据。
- 如果存在追问来源报告，追问来源报告里 high 置信度的依据可以作为延续判断，medium 置信度需要补充现实观察，low 置信度只能作为待验证线索，不能当作确定结论。
- sections 是数组，至少 4 段，每项包含 heading 和 content，分别给洞察、机会、风险、行动建议。
- actions 是 3-5 条可执行建议，每项必须是 { "item": "具体行动", "reason": "为什么这样做", "timebox": "建议执行时间" }；item 或 reason 必须能回到 evidence 的 source 或 insight。
- warnings 是 2-4 条风险提醒，每项必须是 { "title": "风险标题", "detail": "具体误区或边界" }；title 或 detail 必须能回到 evidence 的 source 或 insight。
- reviewChecklist 是 2-4 条复盘清单，每项包含 item、why、evidenceSource、timebox，用来让用户在报告后验证 AI 判断是否帮助了现实行动；evidenceSource 必须能对应 evidence、actions 或 warnings。
- followUps 是 2-4 条适合继续追问的问题，必须围绕本报告的判断依据、行动落地或不确定点。
- lucky 是对象，包含 color、number、direction、timeRange。
- closing 给一句有记忆点的总结。`;
    }

    private buildSourceReportPromptContext(report: AstrologyReport): AstrologySourceReportPromptContext {
        const result = report.result;
        const feedback = report.providerMetadata?.feedback as { rating?: unknown; note?: unknown } | undefined;
        const feedbackRating = typeof feedback?.rating === "string" ? feedback.rating : "";
        const feedbackNote = typeof feedback?.note === "string" ? feedback.note.trim().slice(0, 240) : "";
        return {
            id: report.id,
            reportType: report.reportType,
            title: result?.title || report.question || null,
            summary: result?.summary || report.resultText?.slice(0, 500) || null,
            question: report.question ?? null,
            evidence: (result?.evidence ?? [])
                .filter((item): item is { source: string; insight: string; confidence: "low" | "medium" | "high" } => Boolean(item.source && item.insight && item.confidence))
                .slice(0, 5),
            actions: (result?.actions ?? []).slice(0, 5).map(formatReportActionItem),
            warnings: (result?.warnings ?? []).slice(0, 4).map(formatReportWarningItem),
            reviewChecklist: (result?.reviewChecklist ?? []).slice(0, 4),
            ...(feedbackRating || feedbackNote
                ? {
                      feedback: {
                          ...(feedbackRating ? { rating: feedbackRating } : {}),
                          ...(feedbackNote ? { note: feedbackNote } : {}),
                      },
                  }
                : {}),
        };
    }

    private extractOverallScore(result: AstrologyReportResult) {
        const score = result.scores?.overall ?? Object.values(result.scores ?? {})[0];
        return typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
    }

    private normalizeTargetProfile(value: Record<string, unknown> | undefined) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
        let remaining = MAX_TARGET_PROFILE_CHARS;
        const entries = Object.entries(value).slice(0, MAX_TARGET_PROFILE_KEYS);
        return entries.reduce<Record<string, string>>((accumulator, [key, rawValue]) => {
            if (remaining <= 0) return accumulator;
            const normalizedKey = String(key).trim().slice(0, 80);
            if (!normalizedKey) return accumulator;
            const textValue = this.stringifyTargetValue(rawValue).slice(0, Math.max(0, remaining));
            remaining -= normalizedKey.length + textValue.length;
            accumulator[normalizedKey] = textValue;
            return accumulator;
        }, {});
    }

    private stringifyTargetValue(value: unknown) {
        if (typeof value === "string") return value.trim();
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (Array.isArray(value)) return JSON.stringify(value.slice(0, 10));
        if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 10)));
        return "";
    }

    private buildTags(dto: GenerateAstrologyReportDto, profile: AstrologyProfile | null) {
        return [dto.reportType, dto.focusArea, profile?.zodiacSign, profile?.chineseZodiac].filter(Boolean) as string[];
    }

    private toOptionalString(value: unknown) {
        return typeof value === "string" ? value.trim() || null : null;
    }

    private calculateCost(setting: AstrologyFortuneSetting, reportType: AstrologyReportType): number {
        if (reportType === AstrologyReportType.DAILY) return Number(setting.dailyPrice ?? 0);
        if (reportType === AstrologyReportType.COMPATIBILITY) return Number(setting.compatibilityPrice ?? 0);
        if (reportType === AstrologyReportType.DECISION) return Number(setting.decisionPrice ?? 0);
        return Number(setting.reportPrice ?? 0);
    }

    private toCount(value: string | number | null | undefined) {
        const count = Number(value ?? 0);
        return Number.isFinite(count) ? count : 0;
    }

    private getZodiacSign(date: string) {
        const [, monthText, dayText] = date.slice(0, 10).split("-");
        const month = Number(monthText);
        const day = Number(dayText);
        const signs = ["摩羯座", "水瓶座", "双鱼座", "白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座", "天秤座", "天蝎座", "射手座", "摩羯座"];
        const edgeDays = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];
        return day < (edgeDays[month - 1] ?? 20) ? (signs[month - 1] ?? "摩羯座") : (signs[month] ?? "摩羯座");
    }

    private getChineseZodiac(date: string) {
        const year = Number(date.slice(0, 4));
        return CHINESE_ZODIACS[year % 12] ?? "猴";
    }
}

function formatReportActionItem(item: NonNullable<AstrologyReportResult["actions"]>[number]) {
    if (typeof item === "string") return item;
    return [item.item, item.reason, item.timebox].filter(Boolean).join(" · ");
}

function formatReportWarningItem(item: NonNullable<AstrologyReportResult["warnings"]>[number]) {
    if (typeof item === "string") return item;
    return [item.title, item.detail].filter(Boolean).join(" · ");
}
