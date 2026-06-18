import { BaseService } from "@buildingai/base";
import { ACCOUNT_LOG_TYPE, ACTION } from "@buildingai/constants";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel } from "@buildingai/db/entities";
import { Brackets, EntityManager, In, LessThan, Repository } from "@buildingai/db/typeorm";
import { ExtensionBillingService, PublicAiModelService } from "@buildingai/extension-sdk";
import { HttpErrorFactory } from "@buildingai/errors";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { generateText, Output } from "ai";
import type { Queue } from "bullmq";
import { z } from "zod";

import { AstrologyFortuneSetting, AstrologyProfile, AstrologyReport, AstrologyReportStatus, AstrologyReportType, type AstrologyReportResult } from "../../../db/entities";
import { CreateAstrologyProfileDto, GenerateAstrologyReportDto, QueryAstrologyProfileDto, QueryAstrologyReportDto, UpdateAstrologyFortuneSettingDto, UpdateAstrologyProfileDto } from "../dto";
import { ASTROLOGY_REPORT_JOB, ASTROLOGY_REPORT_QUEUE } from "./astrology-queue.constants";

const DEFAULT_PAGE_SIZE = 20;
const STALE_REPORT_PROCESSING_MS = 30 * 60 * 1000;
const RECOVERY_LOCK_MS = 5 * 60 * 1000;
const MAX_TARGET_PROFILE_KEYS = 20;
const MAX_TARGET_PROFILE_CHARS = 2000;
const CHINESE_ZODIACS = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];
const BUSY_REPORT_STATUSES = [AstrologyReportStatus.PENDING, AstrologyReportStatus.PROCESSING];
const SETTING_KEY = "default";

const reportSchema = z.object({
    title: z.string(),
    summary: z.string(),
    scores: z.record(z.string(), z.number().min(0).max(100)).optional(),
    keywords: z.array(z.string()).optional(),
    lucky: z.object({ color: z.string().optional(), number: z.number().optional(), direction: z.string().optional(), timeRange: z.string().optional() }).optional(),
    sections: z.array(z.object({ heading: z.string(), content: z.string() })).optional(),
    actions: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    closing: z.string().optional(),
});

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
        @InjectRepository(AiModel)
        private readonly modelRepo: Repository<AiModel>,
        @InjectRepository(AccountLog)
        private readonly accountLogRepo: Repository<AccountLog>,
        private readonly billingService: ExtensionBillingService,
        private readonly publicAiModelService: PublicAiModelService,
        @InjectQueue(ASTROLOGY_REPORT_QUEUE)
        private readonly reportQueue: Queue,
    ) {
        super(reportRepo);
    }

    async onModuleInit() {
        await this.recoverInterruptedReports();
        await this.failStaleReports("服务重启后任务超时未完成，请重新生成报告");
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
            providerMetadata: { requestedAt: new Date().toISOString() },
            requestPayload: normalizedDto as unknown as Record<string, unknown>,
        } as Partial<AstrologyReport>);

        await this.enqueueReportJob(report.id);

        return report;
    }

    async executeReportJob(reportId: string) {
        const report = await this.reportRepo.findOne({ where: { id: reportId } });
        if (!report) return null;
        if (!BUSY_REPORT_STATUSES.includes(report.status)) return report;
        if (!report.requestPayload) {
            await this.markReportFailedIfActive(report.id, "报告请求载荷缺失，请重新生成");
            return this.reportRepo.findOne({ where: { id: report.id } });
        }
        return this.processReport(report.id, report.requestPayload as unknown as GenerateAstrologyReportDto, report.profileId ?? null);
    }

    private async processReport(reportId: string, dto: GenerateAstrologyReportDto, profileId: string | null) {
        const report = await this.claimReportForProcessing(reportId);
        if (!report) return null;

        try {
            const model = await this.loadModel(report.modelId, "AI星盘运势默认模型不可用，请管理员重新配置");
            const profile = profileId ? await this.profileRepo.findOne({ where: { id: profileId, userId: report.userId } }) : null;
            await this.reserveReportCreditsOnce(report, model.name);
            const result = await generateText({
                model: await this.resolveLanguageModel(model),
                output: Output.object({ schema: reportSchema }),
                prompt: this.buildPrompt(dto, profile),
                temperature: 0.55,
            });
            const normalized = this.normalizeResult(result.output);
            const resultText = this.buildResultText(normalized);
            const score = this.extractOverallScore(normalized);

            return await this.reportRepo.manager.transaction(async (entityManager) => {
                const currentReport = await this.findActiveReportForWrite(report.id, entityManager);
                if (!currentReport) return null;
                if (![AstrologyReportStatus.PENDING, AstrologyReportStatus.PROCESSING].includes(currentReport.status)) return currentReport;
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
                    },
                });

                if ((dto.reportType === AstrologyReportType.PROFILE || dto.reportType === AstrologyReportType.PERSONALITY) && profile?.id) {
                    const currentProfile = await entityManager.findOne(AstrologyProfile, { where: { id: profile.id, userId: report.userId }, withDeleted: true });
                    if (!currentProfile || currentProfile.deletedAt) return (await entityManager.findOne(AstrologyReport, { where: { id: report.id } })) as AstrologyReport;
                    await entityManager.update(AstrologyProfile, currentProfile.id, {
                        personalitySnapshot: {
                            summary: normalized.summary,
                            keywords: normalized.keywords ?? [],
                            strengths: normalized.actions ?? [],
                            challenges: normalized.warnings ?? [],
                        },
                    });
                }

                return (await entityManager.findOne(AstrologyReport, { where: { id: report.id } })) as AstrologyReport;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Astrology report ${report.id} failed: ${message}`);
            await this.refundReportCreditsIfNeeded(report.id, "AI星盘运势生成失败自动退款");
            await this.markReportFailedIfActive(report.id, message);
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

    async updateFavorite(userId: string, reportId: string, isFavorite: boolean) {
        const report = await this.getReportDetail(userId, reportId);
        await this.reportRepo.update(report.id, { isFavorite });
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

    async cleanupStaleReports() {
        return this.failStaleReports("报告生成超时，请重新生成");
    }

    private async recoverInterruptedReports() {
        const cutoff = new Date(Date.now() - STALE_REPORT_PROCESSING_MS);
        try {
            const reports = await this.reportRepo.find({
                where: {
                    status: In([AstrologyReportStatus.PENDING, AstrologyReportStatus.PROCESSING]),
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
            if (!report || report.deletedAt) return null;
            if (!BUSY_REPORT_STATUSES.includes(report.status) || !report.requestPayload || report.updatedAt > cutoff) return null;
            const metadata = report.providerMetadata ?? {};
            const recoveryLockedAt = typeof metadata.recoveryLockedAt === "string" ? Date.parse(metadata.recoveryLockedAt) : 0;
            if (recoveryLockedAt && Date.now() - recoveryLockedAt < RECOVERY_LOCK_MS) return null;
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
            if (!report || report.deletedAt || !BUSY_REPORT_STATUSES.includes(report.status)) return null;

            const metadata = report.providerMetadata ?? {};
            const processingLockedAt = typeof metadata.processingLockedAt === "string" ? Date.parse(metadata.processingLockedAt) : 0;
            if (
                report.status === AstrologyReportStatus.PROCESSING &&
                processingLockedAt &&
                Date.now() - processingLockedAt < RECOVERY_LOCK_MS
            ) {
                return null;
            }

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
            this.logger.error(`Queue astrology report ${id} failed, using local fallback: ${message}`, error);
            this.runReportInBackground(id);
        }
    }

    private runReportInBackground(id: string) {
        setTimeout(() => {
            void this.executeReportJob(id).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Background astrology report ${id} crashed: ${message}`, error);
                void this.markReportCrashed(id, error);
            });
        }, 0);
    }

    private async failStaleReports(message: string) {
        const cutoff = new Date(Date.now() - STALE_REPORT_PROCESSING_MS);
        let result;
        try {
            const staleReports = await this.reportRepo.find({
                where: { status: In([AstrologyReportStatus.PENDING, AstrologyReportStatus.PROCESSING]), updatedAt: LessThan(cutoff) },
                take: 100,
            });
            for (const report of staleReports) {
                await this.refundReportCreditsIfNeeded(report.id, message);
            }
            result = staleReports.length
                ? await this.reportRepo.update({ id: In(staleReports.map((report) => report.id)) }, { status: AstrologyReportStatus.FAILED, errorMessage: message })
                : { affected: 0 };
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

    private async loadModel(modelId: string, errorMessage = "AI 星盘运势需要可用的 LLM 模型") {
        const model = await this.modelRepo.findOne({ where: { id: modelId, isActive: true }, relations: { provider: true } });
        if (!model || !model.provider || !model.provider.isActive || model.modelType !== "llm") {
            throw HttpErrorFactory.badRequest(errorMessage);
        }
        return model;
    }

    private async resolveLanguageModel(model: AiModel) {
        const providerConfig = this.flattenProviderConfig(await this.publicAiModelService.getProviderConfig(model.id));
        const provider = await this.publicAiModelService.getProviderAdapter(model.id, providerConfig);
        return provider(model.model).model;
    }

    async listAvailableLlmModels() {
        const models = await this.modelRepo.find({
            where: { isActive: true, modelType: "llm" },
            relations: { provider: true },
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
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
        const repo = entityManager?.getRepository(AccountLog) ?? this.accountLogRepo;
        const currentReport = await this.findActiveReportForWrite(report.id, entityManager, true);
        if (!currentReport) return;
        if (currentReport.providerMetadata?.billingStatus === "deducted") return;
        const existingLog = await repo.findOne({ where: { associationNo: report.id, accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC, action: ACTION.DEC }, select: ["id"] });
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
                const accountLogRepo = entityManager.getRepository(AccountLog);
                const wasDeducted = metadata.billingStatus === "deducted" || await accountLogRepo.exists({
                    where: { associationNo: report.id, accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC, action: ACTION.DEC },
                });
                const alreadyRefunded = Boolean(metadata.refundedAt) || await accountLogRepo.exists({
                    where: { associationNo: report.id, accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC, action: ACTION.INC },
                });
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

    private async markReportFailedIfActive(reportId: string, message: string) {
        const report = await this.findActiveReportForWrite(reportId);
        if (!report) return;
        await this.reportRepo.update(reportId, {
            status: AstrologyReportStatus.FAILED,
            errorMessage: message,
            providerMetadata: { ...(report.providerMetadata ?? {}), error: message },
        });
    }

    async markReportCrashed(reportId: string, error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await this.refundReportCreditsIfNeeded(reportId, "AI星盘运势任务异常自动退款");
        await this.markReportFailedIfActive(reportId, message);
    }

    private assertReportNotBusy(report: AstrologyReport) {
        if (BUSY_REPORT_STATUSES.includes(report.status)) {
            throw HttpErrorFactory.badRequest("报告正在生成，暂不能删除");
        }
    }

    private async assertProfileNotUsedByBusyReport(userId: string, profileId: string) {
        const report = await this.reportRepo.findOne({
            where: { userId, profileId, status: In(BUSY_REPORT_STATUSES) },
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

    private buildPrompt(dto: GenerateAstrologyReportDto, profile: AstrologyProfile | null) {
        const profileText = profile
            ? `姓名:${profile.name}\n性别:${profile.gender || "未填写"}\n生日:${profile.birthDate}\n出生时间:${profile.birthTime || "未填写"}\n出生地:${profile.birthPlace || "未填写"}\n太阳星座:${profile.zodiacSign}\n月亮星座:${profile.moonSign || "未填写"}\n上升星座:${profile.risingSign || "未填写"}\n生肖:${profile.chineseZodiac}\n长期画像:${JSON.stringify(profile.personalitySnapshot || {})}`
            : "用户尚未创建长期档案。";

        return `你是一个专业、克制、实用的 AI 星盘运势助手。请结合星座、生肖、出生信息、用户问题和现实生活建议生成个性化报告。
请避免绝对化断言、医疗/法律/投资保证，不要声称确定预测未来。输出必须匹配结构化 schema。

报告类型: ${dto.reportType}
关注方向: ${dto.focusArea || "综合"}
当前状态: ${dto.currentState || "未填写"}
用户问题: ${dto.question || "无"}
语言: ${dto.language || "zh-CN"}

用户档案:
${profileText}

配对对象或目标信息:
${JSON.stringify(dto.targetProfile || {}, null, 2)}

输出要求:
- title 要有吸引力但不要夸张。
- summary 用 1-2 句话给结论。
- scores 至少包含 overall，并按报告类型包含 love/career/wealth/mood/social 等。
- sections 至少 4 段，分别给洞察、机会、风险、行动建议。
- actions 给 3-5 条可执行建议。
- warnings 给 2-4 条风险提醒。
- lucky 包含 lucky color/number/direction/timeRange。
- closing 给一句有记忆点的总结。`;
    }

    private normalizeResult(result: z.infer<typeof reportSchema>): AstrologyReportResult {
        return {
            title: result.title?.trim() || "AI星盘运势报告",
            summary: result.summary?.trim() || "本次报告已生成，请结合现实情况理性参考。",
            scores: result.scores ?? { overall: 75 },
            keywords: (result.keywords ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 8),
            lucky: result.lucky ?? {},
            sections: (result.sections ?? []).map((item) => ({ heading: item.heading.trim(), content: item.content.trim() })).filter((item) => item.heading && item.content).slice(0, 8),
            actions: (result.actions ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 6),
            warnings: (result.warnings ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 6),
            closing: result.closing?.trim() || "把直觉当作提示，把行动交给自己。",
        };
    }

    private buildResultText(result: AstrologyReportResult) {
        const lines = [`# ${result.title}`, "", result.summary, ""];
        if (result.keywords?.length) lines.push(`关键词：${result.keywords.join("、")}`, "");
        for (const section of result.sections ?? []) lines.push(`## ${section.heading}`, section.content, "");
        if (result.actions?.length) lines.push("## 行动建议", ...result.actions.map((item) => `- ${item}`), "");
        if (result.warnings?.length) lines.push("## 风险提醒", ...result.warnings.map((item) => `- ${item}`), "");
        lines.push(result.closing || "");
        return lines.join("\n").trim();
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

    private flattenProviderConfig(config: Record<string, unknown>): Record<string, string> {
        const normalized: Record<string, string> = {};
        Object.entries(config).forEach(([key, item]) => {
            if (typeof item === "string") {
                normalized[key] = item;
                return;
            }
            const value = (item as { value?: unknown } | undefined)?.value;
            if (typeof value === "string") normalized[key] = value;
        });
        return {
            apiKey: normalized.apiKey || normalized.api_key || normalized.API_KEY || "",
            baseURL: normalized.baseURL || normalized.baseUrl || normalized.base_url || "",
        };
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
