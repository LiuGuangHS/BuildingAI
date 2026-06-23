import { BaseService } from "@buildingai/base";
import { ACTION } from "@buildingai/constants";
import { FileUploadService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Brackets, EntityManager, In, LessThan, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import {
    ExtensionBillingService,
    ExtensionNotificationService,
    Output,
    PublicAiModelService,
    assertPublicHttpUrl,
    normalizePublicHttpUrl,
} from "@buildingai/extension-sdk";
import { llmFileParser } from "@buildingai/llm-file-parser";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { Request } from "express";
import { Readable } from "node:stream";
import { z } from "zod";

import {
    ContractGenerationStatus,
    ContractGenerationConfig,
    ContractGenerationTask,
    ContractGenerationVersion,
    ContractTemplateEntity,
    type ContractLegalTerm,
    type ContractRiskFinding,
    type ContractScore,
    type ContractSection,
} from "../../../db/entities";
import { ExportContractDto, GenerateContractDto, QueryContractTaskDto, ReviewUploadedContractDto, RewriteContractClauseDto, UpdateContractConfigDto, UpdateContractContentDto, UpdateRiskActionDto, UpsertContractTemplateDto } from "../dto";
import { CONTRACT_TEMPLATES, type ContractTemplate } from "../templates/contract-templates";
import { CONTRACT_GENERATION_JOB, CONTRACT_GENERATION_QUEUE } from "./contract-queue.constants";
import { buildContractDocx } from "./contract-docx.builder";
import {
    CONTRACT_TASK_BUSY_STATUSES,
    canClaimContractTaskForProcessing,
    canRecoverContractTask,
    isContractTaskBusyStatus,
    resolveContractTaskJobName,
} from "./contract-task-recovery-rules";

const EXTENSION_ID = "echoflow-contract-generation";
const DEFAULT_PAGE_SIZE = 20;
const UPLOAD_REVIEW_MAX_BYTES = 20 * 1024 * 1024;
const UPLOAD_REVIEW_PARSE_TIMEOUT_MS = 20000;
const UPLOAD_REVIEW_MAX_CHARS = 30000;
const UPLOAD_REVIEW_ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md", "rtf"]);
const UPLOAD_REVIEW_ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/rtf",
    "text/plain",
    "text/markdown",
]);
const MAX_VARIABLE_KEYS = 80;
const MAX_VARIABLE_CHARS = 12000;
const MAX_SECTION_CHARS = 20000;
const MAX_PROMPT_LIST_ITEMS = 40;
const CONFIG_KEY = "default";
const VERSION_CREATE_MAX_ATTEMPTS = 2;
const STALE_TASK_PROCESSING_MS = 30 * 60 * 1000;

const sectionSchema = z.object({
    id: z.string().optional(),
    title: z.string(),
    content: z.string(),
    importance: z.enum(["normal", "important", "critical"]).optional(),
});

const riskSchema = z.object({
    sectionTitle: z.string(),
    level: z.enum(["low", "medium", "high"]),
    issue: z.string(),
    suggestion: z.string(),
    replacementText: z.string().optional(),
});

const termSchema = z.object({ term: z.string(), explanation: z.string() });

const scoreSchema = z.object({
    overall: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    riskControl: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    missingItems: z.array(z.string()),
});

const contractSchema = z.object({
    title: z.string(),
    summary: z.string(),
    sections: z.array(sectionSchema).min(3),
    riskFindings: z.array(riskSchema),
    legalTerms: z.array(termSchema),
    score: scoreSchema,
});

const reviewSchema = z.object({
    riskFindings: z.array(riskSchema),
    legalTerms: z.array(termSchema),
    score: scoreSchema,
});

const rewriteSchema = z.object({ content: z.string(), reason: z.string() });

type ReviewUploadTaskPayload = ReviewUploadedContractDto & {
    fileUrl: string;
    fileId: string;
};
type PublicAiModelInfo = NonNullable<Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>>;
type UploadFileInfo = NonNullable<Awaited<ReturnType<FileUploadService["findOneById"]>>>;

@Injectable()
export class ContractGenerationService extends BaseService<ContractGenerationTask> implements OnModuleInit {
    protected readonly logger = new Logger(ContractGenerationService.name);

    constructor(
        @InjectRepository(ContractGenerationTask)
        private readonly taskRepo: Repository<ContractGenerationTask>,
        @InjectRepository(ContractGenerationConfig)
        private readonly configRepo: Repository<ContractGenerationConfig>,
        @InjectRepository(ContractGenerationVersion)
        private readonly versionRepo: Repository<ContractGenerationVersion>,
        @InjectRepository(ContractTemplateEntity)
        private readonly templateRepo: Repository<ContractTemplateEntity>,
        private readonly billingService: ExtensionBillingService,
        private readonly publicAiModelService: PublicAiModelService,
        private readonly fileUploadService: FileUploadService,
        private readonly notificationService: ExtensionNotificationService,
        @InjectQueue(CONTRACT_GENERATION_QUEUE)
        private readonly taskQueue: Queue,
    ) {
        super(taskRepo);
    }

    async onModuleInit() {
        await this.registerNotificationScenes();
        await this.recoverInterruptedGenerationTasks();
        await this.failStaleGenerationTasks("合同生成任务超时，请重新提交");
    }

    private async registerNotificationScenes() {
        await this.notificationService.registerScenes(EXTENSION_ID, [
            {
                sceneCode: `${EXTENSION_ID}.generate.succeeded`,
                name: "合同草稿生成完成",
                description: "用户发起的合同草稿生成任务已完成。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "合同草稿已完成",
                contentTemplate: "{{taskName}} 已生成草稿，可继续审查或导出。",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
            {
                sceneCode: `${EXTENSION_ID}.review.succeeded`,
                name: "上传合同审查完成",
                description: "用户上传合同解析与风险审查已完成。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "合同审查已完成",
                contentTemplate: "{{taskName}} 已完成风险识别，可查看审查结果。",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
            {
                sceneCode: `${EXTENSION_ID}.export.succeeded`,
                name: "合同导出完成",
                description: "合同 DOCX 文件已构建并上传完成。",
                level: "success",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "合同导出完成",
                contentTemplate: "{{taskName}} 已导出 DOCX，可前往下载。",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
            {
                sceneCode: `${EXTENSION_ID}.task.failed`,
                name: "合同任务失败",
                description: "合同生成、上传审查或导出任务失败。",
                level: "error",
                channels: ["in_app", "web_push", "wechat_oa_template"],
                titleTemplate: "合同任务失败",
                contentTemplate: "{{taskName}} 处理失败，{{reason}}",
                linkUrlTemplate: `/extension/${EXTENSION_ID}/`,
            },
        ]);
    }

    async listTemplates() {
        await this.syncBuiltinTemplatesIfMissing();
        const templates = await this.templateRepo.find({ where: { isActive: true }, order: { sortOrder: "DESC", createdAt: "ASC" } });
        return templates;
    }

    async listAdminTemplates() {
        await this.syncBuiltinTemplatesIfMissing();
        return this.templateRepo.find({ order: { sortOrder: "DESC", createdAt: "ASC" } });
    }

    async createTemplate(dto: UpsertContractTemplateDto) {
        const templateInput = this.normalizeTemplateDto(dto);
        await this.assertTemplateUnique(templateInput.contractType as string, templateInput.name as string);
        const template = await this.templateRepo.save(this.templateRepo.create(templateInput));
        return template;
    }

    async updateTemplate(id: string, dto: UpsertContractTemplateDto) {
        const template = await this.templateRepo.findOne({ where: { id } });
        if (!template) throw HttpErrorFactory.notFound("模板不存在");
        const templateInput = this.normalizeTemplateDto(dto);
        await this.assertTemplateUnique(templateInput.contractType as string, templateInput.name as string, id);
        await this.templateRepo.update(id, templateInput);
        return this.templateRepo.findOne({ where: { id } });
    }

    async deleteTemplate(id: string) {
        const template = await this.templateRepo.findOne({ where: { id } });
        if (!template) throw HttpErrorFactory.notFound("模板不存在");
        await this.templateRepo.softDelete(id);
        return { success: true };
    }

    async resetBuiltinTemplates() {
        await this.syncBuiltinTemplates(true);
        return this.listAdminTemplates();
    }

    async getPublicConfig() {
        const model = await this.loadConfiguredModel(false);
        return {
            configured: Boolean(model),
            model: model ? { id: model.id, name: model.name, providerName: model.provider.name, provider: model.provider.provider } : null,
        };
    }

    async getAdminConfig() {
        const config = await this.getOrCreateConfig();
        const model = config.modelId ? await this.loadModel(config.modelId, false) : null;
        return {
            id: config.id,
            modelId: config.modelId,
            metadata: config.metadata ?? null,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
            model: model ? { id: model.id, name: model.name, providerName: model.provider.name, provider: model.provider.provider, pricePerContract: this.calculateCost(model) } : null,
        };
    }

    async updateAdminConfig(dto: UpdateContractConfigDto) {
        const model = await this.loadModel(dto.modelId);
        const config = await this.getOrCreateConfig();
        await this.configRepo.update(config.id, { modelId: model.id, metadata: { ...(config.metadata ?? {}), updatedAt: new Date().toISOString() } });
        return this.getAdminConfig();
    }

    async generate(userId: string, dto: GenerateContractDto) {
        const model = await this.loadConfiguredModel(true);
        const template = await this.getTemplate(dto.templateId);
        const cost = this.calculateCost(model);

        if (cost > 0 && !(await this.billingService.hasSufficientPower(userId, cost))) {
            throw HttpErrorFactory.badRequest("积分不足");
        }

        const variables = this.normalizeVariables(dto.variables ?? {});
        const normalizedDto = { ...dto, variables };
        const task = await this.create({
            userId,
            modelId: model.id,
            providerId: model.provider.id,
            title: dto.title,
            contractType: dto.contractType || template.contractType,
            industry: dto.industry || template.industry,
            templateId: template.id,
            parties: this.extractParties(variables),
            variables,
            prompt: dto.prompt ?? null,
            summary: null,
            sections: [],
            riskFindings: [],
            legalTerms: [],
            score: null,
            status: ContractGenerationStatus.PENDING,
            resultUrl: null,
            errorMessage: null,
            costCredits: cost,
            providerMetadata: { templateName: template.name, language: dto.language ?? "zh-CN", stance: dto.stance ?? "neutral", jobType: CONTRACT_GENERATION_JOB.GENERATE },
            requestPayload: normalizedDto as unknown as Record<string, unknown>,
        } as Partial<ContractGenerationTask>);

        await this.enqueueTaskJob(task.id, CONTRACT_GENERATION_JOB.GENERATE);
        return task;
    }

    async reviewUploadedContract(userId: string, dto: ReviewUploadedContractDto) {
        const model = await this.loadConfiguredModel(true);
        const cost = this.calculateCost(model);
        if (cost > 0 && !(await this.billingService.hasSufficientPower(userId, cost))) {
            throw HttpErrorFactory.badRequest("积分不足");
        }

        const fileSource = await this.resolveReviewFileSource(userId, dto);
        const task = await this.create({
            userId,
            modelId: model.id,
            providerId: model.provider.id,
            title: dto.title?.trim() || "上传合同审查",
            contractType: dto.contractType || "uploaded-review",
            industry: dto.industry || "通用法务",
            templateId: null,
            parties: [],
            variables: { fileUrl: fileSource.fileUrl, fileId: fileSource.fileId },
            prompt: "上传已有合同审查",
            summary: null,
            sections: [],
            riskFindings: [],
            legalTerms: [],
            score: null,
            status: ContractGenerationStatus.PENDING,
            resultUrl: null,
            errorMessage: null,
            costCredits: cost,
            providerMetadata: { source: "upload-review", fileUrl: fileSource.fileUrl, fileId: fileSource.fileId, stance: dto.stance ?? "neutral", jobType: CONTRACT_GENERATION_JOB.REVIEW_UPLOAD },
            requestPayload: { ...dto, fileUrl: fileSource.fileUrl, fileId: fileSource.fileId } as unknown as Record<string, unknown>,
        } as Partial<ContractGenerationTask>);

        await this.enqueueTaskJob(task.id, CONTRACT_GENERATION_JOB.REVIEW_UPLOAD);
        return task;
    }

    async executeTaskJob(taskId: string, jobName: string) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) return null;
        if (![ContractGenerationStatus.PENDING, ContractGenerationStatus.PROCESSING].includes(task.status)) return task;
        const expectedJobName = resolveContractTaskJobName(task);
        if (!expectedJobName || expectedJobName !== jobName) {
            await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, "任务类型与队列类型不匹配，请重新提交");
            return this.taskRepo.findOne({ where: { id: task.id } });
        }
        if (!task.requestPayload) {
            await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, "任务请求载荷缺失，请重新提交");
            return this.taskRepo.findOne({ where: { id: task.id } });
        }

        if (jobName === CONTRACT_GENERATION_JOB.GENERATE) {
            return this.executeGenerateTask(task.id);
        }
        if (jobName === CONTRACT_GENERATION_JOB.REVIEW_UPLOAD) {
            return this.executeReviewUploadTask(task.id);
        }
        return task;
    }

    private async executeGenerateTask(taskId: string) {
        const task = await this.claimTaskForProcessing(taskId);
        if (!task) return null;
        const dto = task.requestPayload as unknown as GenerateContractDto;

        try {
            const model = await this.loadModel(task.modelId);
            const template = await this.getTemplate(dto.templateId ?? task.templateId ?? undefined);
            await this.reserveTaskCreditsOnce(task, model.name);
            const result = await this.publicAiModelService.generateText(model.id, {
                output: Output.object({ schema: contractSchema }),
                prompt: this.buildGeneratePrompt(dto, template),
                temperature: 0.18,
            });

            const output = result.output;
            const sections = this.normalizeSections(output.sections);
            if (sections.length === 0) throw new Error("AI contract generation returned no sections");

            const savedTask = await this.taskRepo.manager.transaction(async (entityManager) => {
                const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
                if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
                if (!isContractTaskBusyStatus(currentTask.status)) return currentTask;
                await entityManager.update(ContractGenerationTask, task.id, {
                    status: ContractGenerationStatus.DRAFT,
                    title: output.title?.trim() || task.title,
                    summary: output.summary?.trim() || null,
                    sections,
                    riskFindings: this.normalizeRisks(output.riskFindings),
                    legalTerms: this.normalizeTerms(output.legalTerms),
                    score: this.normalizeScore(output.score),
                    providerMetadata: {
                        ...(currentTask?.providerMetadata ?? task.providerMetadata ?? {}),
                        provider: model.provider.provider,
                        model: model.model,
                        sectionCount: sections.length,
                    },
                });
                const saved = (await entityManager.findOne(ContractGenerationTask, { where: { id: task.id } })) as ContractGenerationTask | null;
                if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
                await this.createVersion(saved, "generate", "AI 初次生成", entityManager);
                return saved;
            });
            await this.notifyTaskSucceeded(savedTask, "generate");
            return savedTask;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Contract generation task ${task.id} failed: ${message}`);
            await this.refundTaskCreditsIfNeeded(task.id, "AI合同生成失败自动退款");
            await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, message);
            return this.taskRepo.findOne({ where: { id: task.id } });
        }
    }

    private async executeReviewUploadTask(taskId: string) {
        const task = await this.claimTaskForProcessing(taskId);
        if (!task) return null;
        const dto = task.requestPayload as unknown as ReviewUploadTaskPayload;
        const fileUrl = typeof dto.fileUrl === "string" ? dto.fileUrl : undefined;
        if (!fileUrl) {
            await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, "合同文件 URL 缺失，请重新上传");
            return this.taskRepo.findOne({ where: { id: task.id } });
        }

        try {
            const model = await this.loadModel(task.modelId);
            await this.reserveTaskCreditsOnce(task, model.name);
            const content = await llmFileParser.parseAndFormat(fileUrl, { maxFileSize: UPLOAD_REVIEW_MAX_BYTES, timeout: UPLOAD_REVIEW_PARSE_TIMEOUT_MS });
            const result = await this.publicAiModelService.generateText(model.id, {
                output: Output.object({ schema: contractSchema }),
                prompt: this.buildUploadReviewPrompt(dto, content.slice(0, UPLOAD_REVIEW_MAX_CHARS)),
                temperature: 0.12,
            });
            const output = result.output;
            const sections = this.normalizeSections(output.sections);
            if (sections.length === 0) throw new Error("Uploaded contract review returned no sections");

            const savedTask = await this.taskRepo.manager.transaction(async (entityManager) => {
                const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
                if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
                if (!isContractTaskBusyStatus(currentTask.status)) return currentTask;
                await entityManager.update(ContractGenerationTask, task.id, {
                    status: ContractGenerationStatus.DRAFT,
                    title: output.title?.trim() || task.title,
                    summary: output.summary?.trim() || null,
                    sections,
                    riskFindings: this.normalizeRisks(output.riskFindings),
                    legalTerms: this.normalizeTerms(output.legalTerms),
                    score: this.normalizeScore(output.score),
                    providerMetadata: { ...(currentTask?.providerMetadata ?? task.providerMetadata ?? {}), provider: model.provider.provider, model: model.model, reviewedAt: new Date().toISOString(), sourceChars: content.length },
                });
                const saved = (await entityManager.findOne(ContractGenerationTask, { where: { id: task.id } })) as ContractGenerationTask | null;
                if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
                await this.createVersion(saved, "upload_review", "上传合同审查完成", entityManager);
                return saved;
            });
            await this.notifyTaskSucceeded(savedTask, "review");
            return savedTask;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.refundTaskCreditsIfNeeded(task.id, "上传合同审查失败自动退款");
            await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, message);
            return this.taskRepo.findOne({ where: { id: task.id } });
        }
    }

    private async recoverInterruptedGenerationTasks() {
        const cutoff = new Date(Date.now() - STALE_TASK_PROCESSING_MS);
        try {
            const tasks = await this.taskRepo.find({
                where: {
                    status: In(CONTRACT_TASK_BUSY_STATUSES),
                    updatedAt: LessThan(cutoff),
                },
                order: { updatedAt: "ASC" },
                take: 50,
            });
            let recoveredCount = 0;
            for (const task of tasks) {
                const jobName = resolveContractTaskJobName(task);
                if (!jobName) continue;
                const claimedTask = await this.claimTaskForRecovery(task.id, cutoff);
                if (!claimedTask?.requestPayload) continue;
                recoveredCount += 1;
                await this.enqueueTaskJob(claimedTask.id, jobName);
            }
            if (recoveredCount) this.logger.warn(`Recovered ${recoveredCount} interrupted contract generation task(s)`);
            return { affected: recoveredCount };
        } catch (error) {
            if ((error as { code?: string }).code === "42P01") {
                this.logger.warn("Contract generation task table does not exist yet, skipping interrupted task recovery");
                return { affected: 0 };
            }
            throw error;
        }
    }

    private async failStaleGenerationTasks(message: string) {
        const cutoff = new Date(Date.now() - STALE_TASK_PROCESSING_MS);
        try {
            const staleTasks = await this.taskRepo.find({
                where: { status: In(CONTRACT_TASK_BUSY_STATUSES), updatedAt: LessThan(cutoff) },
                take: 100,
            });
            const recoverableTasks = staleTasks.filter((task) => resolveContractTaskJobName(task));
            for (const task of recoverableTasks) {
                await this.refundTaskCreditsIfNeeded(task.id, message);
                await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.FAILED, message, "timeoutError");
            }
            if (recoverableTasks.length) this.logger.warn(`Marked ${recoverableTasks.length} stale contract generation task(s) as failed`);
            return { affected: recoverableTasks.length };
        } catch (error) {
            if ((error as { code?: string }).code === "42P01") {
                this.logger.warn("Contract generation task table does not exist yet, skipping stale task cleanup");
                return { affected: 0 };
            }
            throw error;
        }
    }

    private async claimTaskForRecovery(taskId: string, cutoff: Date) {
        return this.taskRepo.manager.transaction(async (entityManager) => {
            const task = await entityManager.findOne(ContractGenerationTask, {
                where: { id: taskId },
                lock: { mode: "pessimistic_write" },
                withDeleted: true,
            });
            if (!canRecoverContractTask(task, cutoff)) return null;

            const metadata = task.providerMetadata ?? {};
            const providerMetadata = {
                ...metadata,
                recoveredAt: new Date().toISOString(),
                recoveryLockedAt: new Date().toISOString(),
            };
            await entityManager.update(ContractGenerationTask, task.id, {
                status: ContractGenerationStatus.PENDING,
                providerMetadata,
            });
            return {
                ...task,
                status: ContractGenerationStatus.PENDING,
                providerMetadata,
            };
        });
    }

    private async claimTaskForProcessing(taskId: string) {
        return this.taskRepo.manager.transaction(async (entityManager) => {
            const task = await entityManager.findOne(ContractGenerationTask, {
                where: { id: taskId },
                lock: { mode: "pessimistic_write" },
                withDeleted: true,
            });
            if (!canClaimContractTaskForProcessing(task)) return null;

            const metadata = task.providerMetadata ?? {};
            const providerMetadata = {
                ...metadata,
                processingLockedAt: new Date().toISOString(),
            };
            await entityManager.update(ContractGenerationTask, task.id, {
                status: ContractGenerationStatus.PROCESSING,
                providerMetadata,
            });
            return {
                ...task,
                status: ContractGenerationStatus.PROCESSING,
                providerMetadata,
            };
        });
    }

    private async enqueueTaskJob(id: string, jobName: (typeof CONTRACT_GENERATION_JOB)[keyof typeof CONTRACT_GENERATION_JOB]) {
        try {
            await this.taskQueue.add(
                jobName,
                { id },
                {
                    jobId: `contract-generation-${id}-${Date.now()}`,
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Queue contract generation ${id} failed: ${message}`, error);
            await this.markTaskCrashed(id, new Error("AI合同任务队列暂不可用，请稍后重试"));
            throw HttpErrorFactory.badRequest("AI合同任务队列暂不可用，请稍后重试");
        }
    }

    async markTaskCrashed(taskId: string, error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await this.refundTaskCreditsIfNeeded(taskId, "AI合同任务异常自动退款");
        await this.markTaskFailedIfActive(taskId, ContractGenerationStatus.FAILED, message);
    }

    async reviewTask(userId: string, taskId: string) {
        let task = await this.getTaskDetail(userId, taskId);
        this.assertTaskEditable(task);
        if (!task.sections?.length) throw HttpErrorFactory.badRequest("合同暂无可审查内容");
        const model = await this.loadModel(task.modelId);

        let claimed = false;
        try {
            task = await this.claimTaskForInteractiveAction(task.id, ContractGenerationStatus.REVIEWING);
            claimed = true;
            if (!task.sections?.length) throw HttpErrorFactory.badRequest("合同暂无可审查内容");
            const result = await this.publicAiModelService.generateText(model.id, {
                output: Output.object({ schema: reviewSchema }),
                prompt: this.buildReviewPrompt(task),
                temperature: 0.1,
            });
            return await this.taskRepo.manager.transaction(async (entityManager) => {
                const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
                if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
                if (currentTask.status !== ContractGenerationStatus.REVIEWING) return currentTask;
                await entityManager.update(ContractGenerationTask, task.id, {
                    status: ContractGenerationStatus.DRAFT,
                    riskFindings: this.normalizeRisks(result.output.riskFindings),
                    legalTerms: this.normalizeTerms(result.output.legalTerms),
                    score: this.normalizeScore(result.output.score),
                    resultUrl: null,
                    providerMetadata: {
                        ...(currentTask.providerMetadata ?? task.providerMetadata ?? {}),
                        reviewedAt: new Date().toISOString(),
                        reviewBillingPolicy: "free_after_generation",
                    },
                });
                const saved = await this.findActiveTaskForWrite(task.id, entityManager);
                if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
                await this.createVersion(saved, "review", "重新风险审查", entityManager);
                return saved;
            });
        } catch (error) {
            if (claimed) {
                await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.DRAFT, error instanceof Error ? error.message : String(error), "lastReviewError");
            }
            throw error;
        }
    }

    async rewriteClause(userId: string, taskId: string, dto: RewriteContractClauseDto) {
        const task = await this.getTaskDetail(userId, taskId);
        this.assertTaskEditable(task);
        if (!task.sections?.length) throw HttpErrorFactory.badRequest("合同暂无可改写内容");
        const model = await this.loadModel(task.modelId);
        const result = await this.publicAiModelService.generateText(model.id, {
            output: Output.object({ schema: rewriteSchema }),
            prompt: this.buildRewritePrompt(dto),
            temperature: 0.15,
        });
        return {
            ...result.output,
            billingPolicy: "free_after_generation",
        };
    }

    async updateTaskContent(userId: string, taskId: string, dto: UpdateContractContentDto) {
        const task = await this.getTaskDetail(userId, taskId);
        this.assertTaskEditable(task);
        const sections = this.normalizeSections(dto.sections);
        if (sections.length === 0) throw HttpErrorFactory.badRequest("请至少保留一条有效条款");

        return await this.taskRepo.manager.transaction(async (entityManager) => {
            const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await entityManager.update(ContractGenerationTask, task.id, {
                title: dto.title?.trim() || currentTask.title,
                summary: dto.summary?.trim() || currentTask.summary,
                sections,
                status: currentTask.status === ContractGenerationStatus.SUCCESS ? ContractGenerationStatus.DRAFT : currentTask.status,
                resultUrl: currentTask.status === ContractGenerationStatus.SUCCESS ? null : currentTask.resultUrl,
                providerMetadata: { ...(currentTask.providerMetadata ?? {}), editedAt: new Date().toISOString(), sectionCount: sections.length },
            });
            const saved = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await this.createVersion(saved, "edit", "用户保存编辑", entityManager);
            return saved;
        });
    }

    async updateRiskAction(userId: string, taskId: string, dto: UpdateRiskActionDto) {
        const task = await this.getTaskDetail(userId, taskId);
        this.assertTaskEditable(task);
        const nextActions = { ...(task.riskActions ?? {}), [dto.riskKey]: { status: dto.status, actedAt: new Date().toISOString() } };
        const nextSections = dto.status === "accepted" && dto.sections ? this.normalizeSections(dto.sections) : task.sections;
        if (dto.status === "accepted" && dto.sections && nextSections.length === 0) throw HttpErrorFactory.badRequest("采纳风险建议后请至少保留一条有效条款");
        return await this.taskRepo.manager.transaction(async (entityManager) => {
            const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await entityManager.update(ContractGenerationTask, task.id, { riskActions: nextActions, sections: nextSections, status: ContractGenerationStatus.DRAFT, resultUrl: null, providerMetadata: { ...(currentTask.providerMetadata ?? task.providerMetadata ?? {}), riskActionUpdatedAt: new Date().toISOString() } });
            const saved = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await this.createVersion(saved, dto.status === "accepted" ? "risk_accept" : "risk_ignore", dto.status === "accepted" ? "采纳风险建议" : "忽略风险建议", entityManager);
            return saved;
        });
    }

    async getTaskVersions(userId: string, taskId: string) {
        await this.getTaskDetail(userId, taskId);
        return this.versionRepo.find({ where: { taskId }, order: { versionNo: "DESC", createdAt: "DESC" } });
    }

    async restoreTaskVersion(userId: string, taskId: string, versionId: string) {
        const task = await this.getTaskDetail(userId, taskId);
        this.assertTaskEditable(task);
        const version = await this.versionRepo.findOne({ where: { id: versionId, taskId } });
        if (!version) throw HttpErrorFactory.notFound("版本不存在");
        return await this.taskRepo.manager.transaction(async (entityManager) => {
            const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await entityManager.update(ContractGenerationTask, task.id, {
                title: version.title,
                summary: version.summary,
                sections: version.sections,
                riskFindings: version.riskFindings,
                legalTerms: version.legalTerms,
                score: version.score,
                riskActions: version.riskActions,
                status: ContractGenerationStatus.DRAFT,
                resultUrl: null,
                providerMetadata: { ...(currentTask.providerMetadata ?? task.providerMetadata ?? {}), restoredFromVersion: version.versionNo, restoredAt: new Date().toISOString() },
            });
            const saved = await this.findActiveTaskForWrite(task.id, entityManager);
            if (!saved) throw HttpErrorFactory.notFound("任务不存在或已删除");
            await this.createVersion(saved, "restore", `恢复到版本 v${version.versionNo}`, entityManager);
            return saved;
        });
    }

    async exportTask(userId: string, taskId: string, request: Request, dto: ExportContractDto = {}) {
        let task = await this.getTaskDetail(userId, taskId);
        const exportType = dto.exportType ?? (dto.includeRiskReport ? "contract_with_report" : "contract");
        if (task.status === ContractGenerationStatus.SUCCESS && task.resultUrl && task.providerMetadata?.exportType === exportType) return task;
        if ([ContractGenerationStatus.PENDING, ContractGenerationStatus.PROCESSING, ContractGenerationStatus.REVIEWING, ContractGenerationStatus.EXPORTING].includes(task.status)) {
            throw HttpErrorFactory.badRequest("任务正在处理，请稍后再试");
        }
        if (!task.sections?.length) throw HttpErrorFactory.badRequest("合同暂无可导出的条款");

        let claimed = false;
        try {
            task = await this.claimTaskForInteractiveAction(task.id, ContractGenerationStatus.EXPORTING);
            claimed = true;
            if (!task.sections?.length) throw HttpErrorFactory.badRequest("合同暂无可导出的条款");
            const buffer = await buildContractDocx(task, { exportType });
            const upload = await this.fileUploadService.uploadFile(this.createMulterFile(buffer, `${task.id}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), request, undefined, { extensionId: EXTENSION_ID });
            await this.taskRepo.manager.transaction(async (entityManager) => {
                const currentTask = await this.findActiveTaskForWrite(task.id, entityManager);
                if (!currentTask) throw HttpErrorFactory.notFound("任务不存在或已删除");
                if (currentTask.status !== ContractGenerationStatus.EXPORTING) return;
                await entityManager.update(ContractGenerationTask, task.id, {
                    status: ContractGenerationStatus.SUCCESS,
                    resultUrl: upload.url,
                    errorMessage: null,
                    providerMetadata: { ...(currentTask.providerMetadata ?? task.providerMetadata ?? {}), exportedAt: new Date().toISOString(), exportType, fileId: upload.id, fileName: `${task.id}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
                });
            });
            const saved = await this.getTaskDetail(userId, task.id);
            await this.notifyTaskSucceeded(saved, "export");
            return saved;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (claimed) {
                await this.markTaskFailedIfActive(task.id, ContractGenerationStatus.EXPORT_FAILED, message, "lastExportError");
            }
            throw error;
        }
    }

    async getUserTasks(userId: string, query: QueryContractTaskDto) {
        return this.listTasks({ ...query, userId });
    }

    async getTaskDetail(userId: string, taskId: string) {
        const task = await this.taskRepo.findOne({ where: { id: taskId, userId } });
        if (!task) throw HttpErrorFactory.notFound("任务不存在");
        return task;
    }

    async deleteTask(userId: string, taskId: string) {
        const task = await this.getTaskDetail(userId, taskId);
        this.assertTaskNotBusy(task, "删除");
        await this.taskRepo.softDelete({ id: taskId, userId });
        return { success: true };
    }

    async getAllTasks(query: QueryContractTaskDto) {
        return this.listTasks(query);
    }

    async getAdminTaskDetail(taskId: string) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) throw HttpErrorFactory.notFound("任务不存在");
        return task;
    }

    async adminDeleteTask(taskId: string) {
        const task = await this.getAdminTaskDetail(taskId);
        this.assertTaskNotBusy(task, "删除");
        await this.taskRepo.softDelete(taskId);
        return { success: true };
    }

    private async listTasks(query: QueryContractTaskDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const qb = this.taskRepo.createQueryBuilder("task").orderBy("task.createdAt", "DESC");
        this.applyFilters(qb, query);
        const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    private async createVersion(task: ContractGenerationTask, changeType: string, changeSummary: string, entityManager?: EntityManager) {
        if (!entityManager) {
            return this.versionRepo.manager.transaction((manager) => this.createVersion(task, changeType, changeSummary, manager));
        }
        const repo = entityManager.getRepository(ContractGenerationVersion);
        for (let attempt = 1; attempt <= VERSION_CREATE_MAX_ATTEMPTS; attempt += 1) {
            const latest = await repo.findOne({ where: { taskId: task.id }, order: { versionNo: "DESC" }, lock: { mode: "pessimistic_write" }, select: ["id", "versionNo"] });
            try {
                await repo.save(repo.create({
                    taskId: task.id,
                    versionNo: (latest?.versionNo ?? 0) + 1,
                    title: task.title,
                    summary: task.summary ?? null,
                    sections: task.sections ?? [],
                    riskFindings: task.riskFindings ?? [],
                    legalTerms: task.legalTerms ?? [],
                    score: task.score ?? null,
                    riskActions: task.riskActions ?? {},
                    changeType,
                    changeSummary,
                }));
                return;
            } catch (error) {
                if ((error as { code?: string }).code !== "23505" || attempt === VERSION_CREATE_MAX_ATTEMPTS) throw error;
            }
        }
    }

    private assertTaskEditable(task: ContractGenerationTask) {
        if (this.isTaskBusy(task.status)) {
            throw HttpErrorFactory.badRequest("任务正在处理，暂不能编辑");
        }
    }

    private assertTaskNotBusy(task: ContractGenerationTask, action: string) {
        if (this.isTaskBusy(task.status)) {
            throw HttpErrorFactory.badRequest(`任务正在处理，暂不能${action}`);
        }
    }

    private isTaskBusy(status: ContractGenerationStatus) {
        return [ContractGenerationStatus.PENDING, ContractGenerationStatus.PROCESSING, ContractGenerationStatus.REVIEWING, ContractGenerationStatus.EXPORTING].includes(status);
    }

    private async findActiveTaskForWrite(taskId: string, entityManager?: EntityManager) {
        const repo = entityManager ?? this.taskRepo.manager;
        const task = await repo.findOne(ContractGenerationTask, {
            where: { id: taskId },
            withDeleted: true,
            ...(entityManager ? { lock: { mode: "pessimistic_write" as const } } : {}),
        });
        return task && !task.deletedAt ? task : null;
    }

    private async claimTaskForInteractiveAction(taskId: string, status: ContractGenerationStatus.REVIEWING | ContractGenerationStatus.EXPORTING) {
        return this.taskRepo.manager.transaction(async (entityManager) => {
            const task = await entityManager.findOne(ContractGenerationTask, {
                where: { id: taskId },
                lock: { mode: "pessimistic_write" },
                withDeleted: true,
            });
            if (!task || task.deletedAt) throw HttpErrorFactory.notFound("任务不存在或已删除");
            this.assertTaskEditable(task);
            await entityManager.update(ContractGenerationTask, task.id, { status });
            return { ...task, status };
        });
    }

    private async markTaskFailedIfActive(taskId: string, status: ContractGenerationStatus, message: string, errorKey = "error") {
        let failedTask: ContractGenerationTask | null = null;
        await this.taskRepo.manager.transaction(async (entityManager) => {
            const task = await this.findActiveTaskForWrite(taskId, entityManager);
            if (!task) return;
            if (status === ContractGenerationStatus.FAILED && !isContractTaskBusyStatus(task.status)) return;
            if (status === ContractGenerationStatus.DRAFT && task.status !== ContractGenerationStatus.REVIEWING) return;
            if (status === ContractGenerationStatus.EXPORT_FAILED && task.status !== ContractGenerationStatus.EXPORTING) return;

            const providerMetadata: ContractGenerationTask["providerMetadata"] = { ...(task.providerMetadata ?? {}), [errorKey]: message };
            await entityManager.save(ContractGenerationTask, {
                id: task.id,
                status,
                errorMessage: message,
                providerMetadata,
            });
            failedTask = {
                ...task,
                status,
                errorMessage: message,
                providerMetadata,
            };
        });
        if (failedTask) {
            await this.notifyTaskFailed(failedTask, message);
        }
    }

    private async notifyTaskSucceeded(
        task: ContractGenerationTask | null,
        kind: "generate" | "review" | "export",
    ) {
        if (!task) return;
        const sceneCode =
            kind === "generate"
                ? `${EXTENSION_ID}.generate.succeeded`
                : kind === "review"
                  ? `${EXTENSION_ID}.review.succeeded`
                  : `${EXTENSION_ID}.export.succeeded`;
        await this.notificationService.notifyUser({
            userId: task.userId,
            sceneCode,
            level: "success",
            linkUrl: `/extension/${EXTENSION_ID}/`,
            sourceType: kind,
            sourceId: task.id,
            data: {
                taskName: task.title || "合同任务",
                contractType: task.contractType,
                status: task.status,
            },
        });
    }

    private async notifyTaskFailed(task: ContractGenerationTask, message: string) {
        await this.notificationService.notifyUser({
            userId: task.userId,
            sceneCode: `${EXTENSION_ID}.task.failed`,
            level: "error",
            linkUrl: `/extension/${EXTENSION_ID}/`,
            sourceType: `${String(task.providerMetadata?.jobType || "task")}:${task.status}`,
            sourceId: task.id,
            data: {
                taskName: task.title || "合同任务",
                contractType: task.contractType,
                status: task.status,
                reason: message || "请稍后重试或联系管理员",
                billingStatus: task.providerMetadata?.billingStatus,
                refundedAt: task.providerMetadata?.refundedAt,
                refundError: task.providerMetadata?.refundError,
            },
        });
    }

    private applyFilters(qb: ReturnType<Repository<ContractGenerationTask>["createQueryBuilder"]>, query: QueryContractTaskDto) {
        if (query.userId) qb.andWhere("task.userId = :userId", { userId: query.userId });
        if (query.status) qb.andWhere("task.status = :status", { status: query.status });
        if (query.templateId) qb.andWhere("task.templateId = :templateId", { templateId: query.templateId });
        if (query.contractType) qb.andWhere("task.contractType = :contractType", { contractType: query.contractType });
        if (query.modelId) qb.andWhere("task.modelId = :modelId", { modelId: query.modelId });
        if (query.providerId) qb.andWhere("task.providerId = :providerId", { providerId: query.providerId });
        if (query.keyword) {
            qb.andWhere(new Brackets((nested) => nested.where("task.title ILIKE :keyword", { keyword: `%${query.keyword}%` }).orWhere("task.prompt ILIKE :keyword", { keyword: `%${query.keyword}%` })));
        }
    }

    private async loadModel(modelId: string): Promise<PublicAiModelInfo>;
    private async loadModel(modelId: string, throwOnMissing: true): Promise<PublicAiModelInfo>;
    private async loadModel(modelId: string, throwOnMissing: false): Promise<PublicAiModelInfo | null>;
    private async loadModel(modelId: string, throwOnMissing = true) {
        const model = await this.getModelInfo(modelId);
        if (!model || !model.provider || !model.provider.isActive || model.modelType !== "llm") {
            if (!throwOnMissing) return null;
            throw HttpErrorFactory.badRequest("AI 合同需要启用的 LLM 模型");
        }
        return model;
    }


    private async loadConfiguredModel(throwOnMissing: true): Promise<PublicAiModelInfo>;
    private async loadConfiguredModel(throwOnMissing: false): Promise<PublicAiModelInfo | null>;
    private async loadConfiguredModel(throwOnMissing: boolean) {
        const config = await this.getOrCreateConfig();
        if (!config.modelId) {
            if (throwOnMissing) throw HttpErrorFactory.badRequest("AI 合同插件尚未配置固定模型，请联系管理员在插件后台配置");
            return null;
        }
        const model = await this.loadModel(config.modelId, false);
        if (!model && throwOnMissing) throw HttpErrorFactory.badRequest("AI 合同插件配置的固定模型不可用，请联系管理员检查模型状态");
        return model;
    }

    private async getOrCreateConfig() {
        const existing = await this.configRepo.findOne({ where: { key: CONFIG_KEY } });
        if (existing) return existing;
        try {
            return await this.configRepo.save(this.configRepo.create({ key: CONFIG_KEY, modelId: null, metadata: {} }));
        } catch (error) {
            if ((error as { code?: string }).code !== "23505") throw error;
            const racedConfig = await this.configRepo.findOne({ where: { key: CONFIG_KEY } });
            if (racedConfig) return racedConfig;
            throw error;
        }
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
                provider: model.provider.provider,
                pricePerContract: this.calculateCost(model),
            }));
    }

    private async reserveTaskCreditsOnce(task: ContractGenerationTask, modelName: string, entityManager?: EntityManager) {
        const cost = Number(task.costCredits ?? 0);
        if (cost <= 0) return;
        if (!entityManager) {
            return this.taskRepo.manager.transaction((manager) => this.reserveTaskCreditsOnce(task, modelName, manager));
        }
        const currentTask = await entityManager.findOne(ContractGenerationTask, { where: { id: task.id }, lock: { mode: "pessimistic_write" }, withDeleted: true });
        if (!currentTask || currentTask.deletedAt) return;
        if (currentTask.providerMetadata?.billingStatus === "deducted") return;
        const existingLog = await this.billingService.hasBillingLog({ associationNo: task.id, action: ACTION.DEC }, entityManager);
        if (!existingLog) {
            await this.billingService.deductUserPower({ userId: task.userId, amount: cost, remark: `AI合同: ${modelName}`, associationNo: task.id, associationUserId: task.userId }, entityManager);
        }
        await entityManager.update(ContractGenerationTask, task.id, {
            providerMetadata: {
                ...(currentTask.providerMetadata ?? task.providerMetadata ?? {}),
                billingStatus: "deducted",
                billedAt: new Date().toISOString(),
            },
        });
    }

    private async refundTaskCreditsIfNeeded(taskId: string, remark: string) {
        try {
            await this.taskRepo.manager.transaction(async (entityManager) => {
                const task = await entityManager.findOne(ContractGenerationTask, { where: { id: taskId }, lock: { mode: "pessimistic_write" }, withDeleted: true });
                if (!task || Number(task.costCredits ?? 0) <= 0) return;
                const metadata = task.providerMetadata ?? {};
                const wasDeducted = metadata.billingStatus === "deducted" || await this.billingService.hasBillingLog({ associationNo: task.id, action: ACTION.DEC }, entityManager);
                const alreadyRefunded = Boolean(metadata.refundedAt) || await this.billingService.hasBillingLog({ associationNo: task.id, action: ACTION.INC }, entityManager);
                if (!wasDeducted || alreadyRefunded) return;
                await this.billingService.addUserPower({ userId: task.userId, amount: Number(task.costCredits), remark, associationNo: task.id, associationUserId: task.userId }, entityManager);
                await entityManager.update(ContractGenerationTask, task.id, {
                    providerMetadata: {
                        ...metadata,
                        billingStatus: "refunded",
                        refundedAt: new Date().toISOString(),
                        refundRemark: remark,
                    },
                });
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Contract task ${taskId} refund failed: ${message}`);
            const task = await this.taskRepo.findOne({ where: { id: taskId }, withDeleted: true });
            if (!task) return;
            await this.taskRepo.update(taskId, {
                providerMetadata: {
                    ...(task.providerMetadata ?? {}),
                    refundError: message,
                },
            });
        }
    }

    private async getTemplate(templateId?: string | null): Promise<ContractTemplate> {
        await this.syncBuiltinTemplatesIfMissing();
        const activeTemplates = await this.templateRepo.find({ where: { isActive: true }, order: { sortOrder: "DESC", createdAt: "ASC" } });
        if (activeTemplates.length === 0) throw HttpErrorFactory.badRequest("AI 合同插件暂无启用模板，请联系管理员启用模板");
        const selected = templateId ? activeTemplates.find((template) => template.id === templateId) : activeTemplates[0];
        if (!selected) throw HttpErrorFactory.badRequest("合同模板不存在或未启用，请重新选择模板");
        return this.toTemplate(selected);
    }

    private toTemplate(template: ContractTemplateEntity): ContractTemplate {
        return {
            id: template.id,
            name: template.name,
            industry: template.industry,
            contractType: template.contractType,
            description: template.description,
            fields: template.fields,
            defaultSections: template.defaultSections,
            promptTemplate: template.promptTemplate,
        };
    }

    private normalizeTemplateDto(dto: UpsertContractTemplateDto): Partial<ContractTemplateEntity> {
        const name = dto.name.trim();
        const industry = dto.industry.trim();
        const contractType = dto.contractType.trim();
        const description = dto.description.trim();
        if (!name || !industry || !contractType || !description) throw HttpErrorFactory.badRequest("模板名称、行业、类型和描述不能为空");
        const fields = this.normalizeTemplateFields(dto.fields);
        if (fields.length === 0) throw HttpErrorFactory.badRequest("模板至少需要一个有效字段");
        const defaultSections = (Array.isArray(dto.defaultSections) ? dto.defaultSections : []).map((section) => String(section).trim().slice(0, 120)).filter(Boolean).slice(0, 40);
        if (defaultSections.length === 0) throw HttpErrorFactory.badRequest("模板至少需要一个默认条款");

        return {
            name,
            industry,
            contractType,
            description,
            fields,
            defaultSections,
            promptTemplate: dto.promptTemplate?.trim() || null,
            isActive: dto.isActive ?? true,
            sortOrder: dto.sortOrder ?? 0,
        };
    }

    private normalizeTemplateFields(fields: UpsertContractTemplateDto["fields"]) {
        return (Array.isArray(fields) ? fields : [])
            .slice(0, MAX_PROMPT_LIST_ITEMS)
            .map((field) => ({
                key: String(field.key ?? "").trim().slice(0, 80),
                label: String(field.label ?? "").trim().slice(0, 120),
                type: field.type,
                required: Boolean(field.required),
                placeholder: field.placeholder ? String(field.placeholder).trim().slice(0, 200) : undefined,
                options: Array.isArray(field.options) ? field.options.slice(0, 40).map((option) => String(option).trim().slice(0, 120)).filter(Boolean) : undefined,
            }))
            .filter((field) => field.key && field.label && ["text", "textarea", "number", "date", "select"].includes(field.type));
    }

    private async assertTemplateUnique(contractType: string, name: string, excludeId?: string) {
        const query = this.templateRepo
            .createQueryBuilder("template")
            .where("template.contractType = :contractType", { contractType })
            .andWhere("template.name = :name", { name });
        if (excludeId) query.andWhere("template.id <> :excludeId", { excludeId });
        const duplicate = await query.getOne();
        if (duplicate) throw HttpErrorFactory.badRequest("同一合同类型下已存在同名模板");
    }

    private async syncBuiltinTemplatesIfMissing() {
        const existing = await this.templateRepo.find({ withDeleted: true });
        const existingByType = new Set(existing.map((template) => `${template.contractType}:${template.name}`));
        if (CONTRACT_TEMPLATES.some((template) => !existingByType.has(`${template.contractType}:${template.name}`))) {
            await this.syncBuiltinTemplates(false);
        }
    }

    private async syncBuiltinTemplates(reset: boolean) {
        if (reset) await this.templateRepo.softDelete({ isBuiltin: true });
        const existing = await this.templateRepo.find();
        const existingByType = new Map(existing.map((template) => [`${template.contractType}:${template.name}`, template]));
        for (const [index, template] of CONTRACT_TEMPLATES.entries()) {
            const key = `${template.contractType}:${template.name}`;
            if (existingByType.has(key)) continue;
            const { id: _builtinId, ...templatePayload } = template;
            await this.templateRepo.save(this.templateRepo.create({ ...templatePayload, promptTemplate: null, isBuiltin: true, isActive: true, sortOrder: CONTRACT_TEMPLATES.length - index }));
        }
    }

    private buildGeneratePrompt(dto: GenerateContractDto, template: ContractTemplate) {
        return `你是一名严谨的中国商业合同起草助手。请输出符合 schema 的结构化合同数据，不要输出 Markdown。

重要限制：
- 内容仅供参考，不得宣称构成法律意见。
- 条款要具体、可执行，避免空泛表达。
- 主动补齐付款、验收、违约、解除、保密、争议解决等关键风险条款。
- 风险提示要指出缺失或不清楚的信息，并给出可替换文本。

合同标题：${dto.title}
模板：${template.name}
行业：${dto.industry || template.industry}
合同类型：${dto.contractType || template.contractType}
目标语言：${dto.language ?? "zh-CN"}
合同立场：${this.getStanceInstruction(dto.stance)}
默认条款结构：${template.defaultSections.join("、")}
用户填写字段：${JSON.stringify(dto.variables ?? {}, null, 2)}
补充要求：${dto.prompt || "无"}
后台模板额外提示：${template.promptTemplate || "无"}`;
    }

    private getStanceInstruction(stance?: GenerateContractDto["stance"]) {
        return {
            neutral: "中立平衡，兼顾双方权利义务。",
            favor_party_a: "适度偏向甲方，强化乙方交付、付款保障、违约责任和甲方解除权。",
            favor_party_b: "适度偏向乙方，强化付款确定性、验收时限、责任边界和乙方免责场景。",
            strict: "更严格严谨，条款细化到可执行标准，减少模糊表述。",
            friendly: "更友好易懂，在保持风险控制的同时降低对抗性表达。",
        }[stance ?? "neutral"];
    }

    private buildReviewPrompt(task: ContractGenerationTask) {
        return `你是一名合同风险审查助手。请审查以下合同，输出 riskFindings、legalTerms、score 三部分结构化数据。
要求：识别高/中/低风险，给出修改建议和可替换文本；评分 0-100；说明缺失关键条款。

合同标题：${task.title}
合同正文：
${task.sections.map((section, index) => `${index + 1}. ${section.title}\n${section.content}`).join("\n\n")}`;
    }

    private buildUploadReviewPrompt(dto: ReviewUploadedContractDto, content: string) {
        return `你是一名合同审查助手。请从用户上传的合同文本中提取合同标题、摘要和核心条款，并输出符合 schema 的结构化数据。
要求：
- 保留原合同主要条款含义，不要凭空重写整份合同。
- 将长合同拆分为清晰条款 sections。
- 识别高/中/低风险，给出修改建议和可替换文本。
- 输出法律术语解释和 0-100 的完整度/风险控制/清晰度评分。
- 内容仅供参考，不构成法律意见。

合同类型：${dto.contractType || "未指定"}
行业：${dto.industry || "未指定"}
审查立场：${this.getStanceInstruction(dto.stance)}
用户指定标题：${dto.title || "未指定"}

上传合同正文：
${content}`;
    }

    private async resolveReviewFileSource(userId: string, dto: ReviewUploadedContractDto) {
        const file = await this.fileUploadService.findOneById(dto.fileId);
        if (!file || file.uploaderId !== userId) throw HttpErrorFactory.badRequest("合同文件不存在或无权访问");
        if (file.extensionIdentifier !== EXTENSION_ID) throw HttpErrorFactory.badRequest("合同文件不属于当前插件");
        this.assertReviewFileSupported(file);
        if (!file.url) throw HttpErrorFactory.badRequest("合同文件缺少可访问 URL");
        return {
            fileId: file.id,
            fileUrl: await this.normalizeStoredFileUrl(file.url),
        };
    }

    private assertReviewFileSupported(file: UploadFileInfo) {
        if (Number(file.size ?? 0) > UPLOAD_REVIEW_MAX_BYTES) {
            throw HttpErrorFactory.badRequest("合同文件不能超过 20MB");
        }
        const extension = String(file.extension || file.originalName?.split(".").pop() || "").toLowerCase().replace(/^\./, "");
        const mimeType = String(file.mimeType || "").toLowerCase().split(";")[0]?.trim();
        const extensionAllowed = UPLOAD_REVIEW_ALLOWED_EXTENSIONS.has(extension);
        const mimeAllowed = Boolean(mimeType && UPLOAD_REVIEW_ALLOWED_MIME_TYPES.has(mimeType));
        if (!extensionAllowed && !mimeAllowed) {
            throw HttpErrorFactory.badRequest("仅支持 PDF、Word、RTF、TXT 或 Markdown 合同文件");
        }
    }

    private async normalizeStoredFileUrl(value: string) {
        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
            if (url.username || url.password) throw new Error("credentials not allowed");
            const isPlatformUpload =
                    url.pathname.startsWith(`/${EXTENSION_ID}/uploads/`) ||
                    url.pathname.startsWith("/uploads/");
            if (!isPlatformUpload) {
                await assertPublicHttpUrl(value, { label: "合同文件 URL" });
            }
            url.hash = "";
            return url.toString();
        } catch {
            throw HttpErrorFactory.badRequest("合同文件 URL 格式不正确或不安全");
        }
    }

    private buildRewritePrompt(dto: RewriteContractClauseDto) {
        const modeLabel = {
            stricter: "更严谨",
            favor_party_a: "更偏甲方",
            favor_party_b: "更偏乙方",
            concise: "更简洁",
            friendly: "更友好",
            reduce_risk: "降低风险",
        }[dto.mode ?? "reduce_risk"];
        return `请将以下合同条款改写为“${modeLabel}”版本。输出 content 和 reason。
条款标题：${dto.sectionTitle}
原条款：${dto.content}`;
    }

    private extractParties(variables: Record<string, unknown>) {
        return [
            { name: String(variables.partyA ?? "").trim(), role: "甲方" },
            { name: String(variables.partyB ?? "").trim(), role: "乙方" },
        ].filter((party) => party.name);
    }

    private normalizeSections(sections: ContractSection[]) {
        return (Array.isArray(sections) ? sections : [])
            .slice(0, 80)
            .map((section, index) => ({ id: section.id || `section-${index + 1}`, title: String(section.title ?? "").trim().slice(0, 200), content: String(section.content ?? "").trim().slice(0, MAX_SECTION_CHARS), importance: section.importance ?? "normal" }))
            .filter((section) => section.title && section.content);
    }

    private normalizeVariables(variables: Record<string, unknown>) {
        const entries = Object.entries(variables ?? {}).slice(0, MAX_VARIABLE_KEYS);
        let remaining = MAX_VARIABLE_CHARS;
        return entries.reduce<Record<string, unknown>>((accumulator, [key, value]) => {
            if (remaining <= 0) return accumulator;
            const normalizedKey = String(key).trim().slice(0, 80);
            if (!normalizedKey) return accumulator;
            const normalizedValue = this.stringifyVariableValue(value);
            const text = String(normalizedValue ?? "").slice(0, Math.max(0, remaining));
            remaining -= normalizedKey.length + text.length;
            accumulator[normalizedKey] = text;
            return accumulator;
        }, {});
    }

    private stringifyVariableValue(value: unknown) {
        if (typeof value === "string") return value.trim();
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (Array.isArray(value)) return JSON.stringify(value.slice(0, 20));
        if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 20)));
        return "";
    }

    private normalizeRisks(risks: ContractRiskFinding[]) {
        return (Array.isArray(risks) ? risks : []).slice(0, MAX_PROMPT_LIST_ITEMS).map((risk) => ({ sectionTitle: String(risk.sectionTitle ?? "").trim().slice(0, 200), level: risk.level ?? "medium", issue: String(risk.issue ?? "").trim().slice(0, 1000), suggestion: String(risk.suggestion ?? "").trim().slice(0, 2000), replacementText: risk.replacementText ? String(risk.replacementText).trim().slice(0, MAX_SECTION_CHARS) : undefined })).filter((risk) => risk.sectionTitle && risk.issue && risk.suggestion);
    }

    private normalizeTerms(terms: ContractLegalTerm[]) {
        return (Array.isArray(terms) ? terms : []).slice(0, MAX_PROMPT_LIST_ITEMS).map((term) => ({ term: String(term.term ?? "").trim().slice(0, 120), explanation: String(term.explanation ?? "").trim().slice(0, 1000) })).filter((term) => term.term && term.explanation);
    }

    private normalizeScore(score: ContractScore | null | undefined): ContractScore {
        return { overall: this.clampScore(score?.overall), completeness: this.clampScore(score?.completeness), riskControl: this.clampScore(score?.riskControl), clarity: this.clampScore(score?.clarity), missingItems: Array.isArray(score?.missingItems) ? score.missingItems.map(String).filter(Boolean) : [] };
    }

    private clampScore(value: unknown) {
        const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return Math.max(0, Math.min(100, Math.round(number)));
    }

    private calculateCost(model: PublicAiModelInfo): number {
        const config = this.normalizeModelConfig(model);
        const price = config?.pricePerContract;
        return typeof price === "number" ? price : 0;
    }

    private normalizeModelConfig(model: PublicAiModelInfo): Record<string, unknown> | null {
        if (!model.modelConfig) return null;
        if (!Array.isArray(model.modelConfig)) return this.pickContractModelConfig(model.modelConfig as Record<string, unknown>);
        const items = model.modelConfig as unknown[];
        return items.reduce<Record<string, unknown>>((accumulator, item) => {
            if (item && typeof item === "object" && "field" in item && typeof item.field === "string") {
                const field = item.field.trim();
                if (!field) return accumulator;
                if (field === "pricePerContract" && "value" in item) {
                    accumulator.pricePerContract = this.toOptionalNumber((item as { value?: unknown }).value);
                }
                return accumulator;
            }
            if (item && typeof item === "object") {
                const picked = this.pickContractModelConfig(item as Record<string, unknown>);
                if (picked.pricePerContract !== undefined) {
                    accumulator.pricePerContract = picked.pricePerContract;
                }
            }
            return accumulator;
        }, {});
    }

    private pickContractModelConfig(config: Record<string, unknown>) {
        const pricePerContract = this.toOptionalNumber(config.pricePerContract);
        return pricePerContract === undefined ? {} : { pricePerContract };
    }

    private toOptionalNumber(value: unknown): number | undefined {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim()) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
    }

    private createMulterFile(buffer: Buffer, filename: string, mimetype: string): Express.Multer.File {
        return { fieldname: "file", originalname: filename, encoding: "7bit", mimetype, size: buffer.length, buffer, destination: "", filename, path: "", stream: Readable.from(buffer) };
    }
}
