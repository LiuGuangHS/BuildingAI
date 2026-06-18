import { generateText } from "@buildingai/ai-sdk";
import { ACCOUNT_LOG_TYPE, ACTION } from "@buildingai/constants/shared/account-log.constants";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog } from "@buildingai/db/entities";
import type { EntityManager, FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { ExtensionBillingService, PublicAiModelService } from "@buildingai/extension-sdk";
import { Injectable, Logger } from "@nestjs/common";

import {
    VideoPromptOptimization,
    VideoPromptOptimizationBillingStatus,
} from "../../../db/entities/video-prompt-optimization.entity";
import type {
    OptimizePromptDto,
    PromptOptimizationStyle,
} from "../dto/prompt-optimization.dto";
import { ProviderConfigService } from "./provider-config.service";

export interface PromptOptimizationResult {
    originalPrompt: string;
    optimizedPrompt: string;
    source: "ai" | "local";
    style: PromptOptimizationStyle;
    modelId?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    consumedPower?: number;
    warning?: string;
}

@Injectable()
export class PromptOptimizationService {
    private readonly logger = new Logger(PromptOptimizationService.name);

    constructor(
        private readonly providerConfigService: ProviderConfigService,
        private readonly aiModelService: PublicAiModelService,
        private readonly billingService: ExtensionBillingService,
        @InjectRepository(VideoPromptOptimization)
        private readonly optimizationRepository: Repository<VideoPromptOptimization>,
        @InjectRepository(AccountLog)
        private readonly accountLogRepository: Repository<AccountLog>,
    ) {}

    async optimize(dto: OptimizePromptDto, userId?: string): Promise<PromptOptimizationResult> {
        const existing = await this.findExistingRequest(userId, dto.requestKey);
        if (existing) {
            return this.returnExistingResult(existing);
        }

        const config = await this.providerConfigService.getConsoleConfig();
        if (config.promptOptimizerEnabled === false) {
            throw HttpErrorFactory.badRequest("提示词优化已在管理后台关闭");
        }

        const prompt = this.sanitizeText(dto.prompt, 2000);
        const style = dto.style ?? "cinematic";
        const modelId = await this.resolveUsableOptimizerModelId(
            dto.modelId,
            config.promptOptimizerModelId,
            config.promptOptimizerAllowedModelIds,
        );

        if (!modelId) {
            const result: PromptOptimizationResult = {
                originalPrompt: prompt,
                optimizedPrompt: this.localOptimize(prompt, style, dto),
                source: "local",
                style,
            };
            const freeRecord = await this.createFreeOptimizationRecord(result, userId, dto.requestKey);
            if (freeRecord?.reused) {
                return this.returnExistingResult(freeRecord.record);
            }
            await this.persistAiOptimizationResult(freeRecord?.record.id, result);
            return result;
        }

        const pending = await this.createPendingAiRecord(prompt, style, modelId, userId, dto.requestKey);
        if (pending.reused) {
            return this.returnExistingResult(pending.record);
        }
        const { record } = pending;

        try {
            const result = await this.aiOptimize(record, modelId, prompt, style, dto, userId, config);
            const response: PromptOptimizationResult = {
                originalPrompt: prompt,
                optimizedPrompt: result.optimizedPrompt,
                source: "ai",
                style,
                modelId,
                usage: result.usage,
                consumedPower: result.consumedPower,
            };
            await this.persistAiOptimizationResult(record.id, response);
            return response;
        } catch (error) {
            if (this.isInsufficientPowerError(error)) {
                const message = error instanceof Error ? error.message : String(error);
                await this.markOptimizationFailed(record.id, message);
                throw error;
            }
            const warning = error instanceof Error ? error.message : "提示词优化模型调用失败";
            this.logger.warn(`Prompt optimization fell back to local mode: ${warning}`);
            const refunded = await this.refundOptimizationBilling(record.id, userId, `Echoflow Video 提示词优化失败退款: ${modelId}`);
            const result: PromptOptimizationResult = {
                originalPrompt: prompt,
                optimizedPrompt: this.localOptimize(prompt, style, dto),
                source: "local",
                style,
                modelId,
                warning: "AI 优化模型暂不可用，已使用本地规则优化",
                consumedPower: 0,
            };
            await this.persistAiOptimizationResult(record.id, result, refunded ? VideoPromptOptimizationBillingStatus.REFUNDED : VideoPromptOptimizationBillingStatus.FREE);
            return result;
        }
    }

    private async aiOptimize(
        record: VideoPromptOptimization,
        modelId: string,
        prompt: string,
        style: PromptOptimizationStyle,
        dto: OptimizePromptDto,
        userId: string | undefined,
        config: Awaited<ReturnType<ProviderConfigService["getConsoleConfig"]>>,
    ): Promise<{
        optimizedPrompt: string;
        usage?: PromptOptimizationResult["usage"];
        consumedPower?: number;
    }> {
        const modelInfo = await this.aiModelService.getModelInfo(modelId);
        const providerConfig = this.flattenProviderConfig(
            await this.aiModelService.getProviderConfig(modelId),
        );
        const provider = await this.aiModelService.getProviderAdapter(modelId, providerConfig);
        if (!provider.supports("language")) {
            throw new Error("所选主站模型不支持文本生成");
        }

        const billingRule = this.resolveBillingRule(modelInfo.billingRule, config);
        const estimatedPower = this.calculateConsumedPower(
            config.promptOptimizerEstimatedTokens ?? 500,
            billingRule,
        );
        const billingEnabled = config.promptOptimizerBillingEnabled !== false && Boolean(userId) && estimatedPower > 0;
        if (billingEnabled) {
            if (!(await this.billingService.hasSufficientPower(userId!, estimatedPower))) {
                throw HttpErrorFactory.badRequest("积分不足，请充值后重试");
            }
            await this.deductOptimizationBilling(record.id, userId!, estimatedPower, modelId);
        }

        const system = [
            "You are a professional AI video prompt director.",
            "Rewrite user intent into one concise production-ready video generation prompt.",
            "Return only the optimized prompt, no markdown, no JSON, no explanation.",
            "Prefer clear English visual language even when the user input is Chinese.",
            "Include subject, scene, motion, camera movement, lighting, mood, composition, and visual quality.",
            "Do not invent brand names, celebrities, private persons, or unsafe content.",
        ].join("\n");
        const userPrompt = [
            `Original prompt: ${prompt}`,
            `Video model: ${dto.model || "unknown"}`,
            `Style: ${style}`,
            dto.ratio ? `Aspect ratio: ${dto.ratio}` : "",
            dto.resolution ? `Resolution: ${dto.resolution}` : "",
            "Optimized video prompt:",
        ].filter(Boolean).join("\n");

        const result = await generateText({
            model: provider(modelInfo.model).model,
            system,
            prompt: userPrompt,
            temperature: 0.7,
        });

        const usage = await this.resolveUsage(result, `${system}\n${userPrompt}`, result.text);
        return {
            optimizedPrompt: this.normalizeOptimizedPrompt(result.text, prompt),
            usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
            },
            consumedPower: billingEnabled ? estimatedPower : 0,
        };
    }

    async getOptions() {
        const config = await this.providerConfigService.getConsoleConfig();
        const modelIds = this.resolveAllowedModelIds(
            config.promptOptimizerModelId,
            config.promptOptimizerAllowedModelIds,
        );
        const models = await Promise.all(
            modelIds.map(async (id) => {
                try {
                    const model = await this.aiModelService.getModelInfo(id);
                    this.assertModelUsable(model, id === config.promptOptimizerModelId ? "默认提示词优化模型" : "提示词优化模型");
                    return {
                        id: model.id,
                        name: model.name,
                        model: model.model,
                        provider: model.provider?.provider,
                        isDefault: model.id === config.promptOptimizerModelId,
                        billingRule: model.billingRule,
                    };
                } catch {
                    return undefined;
                }
            }),
        );

        const usableModels = models.filter((model): model is NonNullable<typeof model> => Boolean(model));
        const defaultModelId = usableModels.some((model) => model.id === config.promptOptimizerModelId)
            ? config.promptOptimizerModelId
            : usableModels[0]?.id;

        return {
            enabled: config.promptOptimizerEnabled !== false,
            defaultModelId,
            billingEnabled: config.promptOptimizerBillingEnabled !== false,
            models: usableModels,
        };
    }

    private localOptimize(
        prompt: string,
        style: PromptOptimizationStyle,
        dto: Pick<OptimizePromptDto, "model" | "ratio" | "resolution">,
    ): string {
        const stylePhrase = this.stylePhrase(style);
        const modelHint = dto.model?.includes("video-edit")
            ? "preserve the main subject and natural motion from the input video"
            : dto.model?.includes("i2v")
              ? "animate the input image with natural subject motion"
              : dto.model?.includes("r2v")
                ? "use the reference images to keep subject identity and visual consistency"
                : "generate the scene from text";
        const technical = [
            stylePhrase,
            "smooth camera movement",
            "natural motion",
            "coherent temporal consistency",
            "detailed composition",
            "high quality video",
            dto.ratio ? `${dto.ratio} aspect ratio` : "",
            dto.resolution ? `${dto.resolution} output` : "",
        ].filter(Boolean).join(", ");

        return this.normalizeOptimizedPrompt(
            `${prompt}, ${modelHint}, ${technical}`,
            prompt,
        );
    }

    private stylePhrase(style: PromptOptimizationStyle): string {
        switch (style) {
            case "commercial":
                return "premium commercial product cinematography, clean studio lighting";
            case "realistic":
                return "realistic documentary cinematography, natural light";
            case "anime":
                return "anime-inspired visual style, expressive motion, vibrant colors";
            case "minimal":
                return "minimal clean composition, restrained camera movement";
            case "cinematic":
            default:
                return "cinematic lighting, filmic color grading, depth of field";
        }
    }

    private normalizeOptimizedPrompt(value: string, fallback: string): string {
        const cleaned = this.sanitizeText(
            value
                .replace(/^```(?:json|text)?/i, "")
                .replace(/```$/i, "")
                .replace(/^["']|["']$/g, "")
                .trim(),
            1800,
        );
        return cleaned || fallback;
    }

    private async resolveUsableOptimizerModelId(
        requestedModelId: string | undefined,
        defaultModelId: string | undefined,
        allowedModelIds: string[] | undefined,
    ): Promise<string | undefined> {
        const allowed = this.resolveAllowedModelIds(defaultModelId, allowedModelIds);
        const requested = requestedModelId?.trim();
        if (requested) {
            if (!allowed.includes(requested)) {
                throw HttpErrorFactory.badRequest("所选提示词优化模型未在管理后台开放");
            }
            await this.assertOptimizerModelUsable(requested, "提示词优化模型");
            return requested;
        }

        for (const modelId of allowed) {
            try {
                await this.assertOptimizerModelUsable(modelId, modelId === defaultModelId?.trim() ? "默认提示词优化模型" : "提示词优化模型");
                return modelId;
            } catch (error) {
                this.logger.warn(`Prompt optimizer model ${modelId} is not usable, trying next model: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return undefined;
    }

    private resolveAllowedModelIds(
        defaultModelId: string | undefined,
        allowedModelIds: string[] | undefined,
    ): string[] {
        return Array.from(
            new Set(
                [
                    defaultModelId?.trim(),
                    ...(allowedModelIds ?? []).map((modelId) => modelId.trim()),
                ].filter(Boolean) as string[],
            ),
        );
    }

    private resolveBillingRule(
        modelBillingRule: { power?: number; tokens?: number } | undefined,
        config: Awaited<ReturnType<ProviderConfigService["getConsoleConfig"]>>,
    ) {
        return {
            power: Number(modelBillingRule?.power ?? config.promptOptimizerBillingPower ?? 1),
            tokens: Number(modelBillingRule?.tokens ?? config.promptOptimizerBillingTokens ?? 1000),
        };
    }

    private calculateConsumedPower(totalTokens: number, billingRule: { power: number; tokens: number }) {
        if (billingRule.power <= 0 || billingRule.tokens <= 0) return 0;
        return Math.ceil((totalTokens / billingRule.tokens) * billingRule.power);
    }

    private async resolveUsage(
        result: unknown,
        inputText: string,
        outputText: string,
    ): Promise<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }> {
        const usage = await Promise.resolve(
            (result as { usage?: PromiseLike<PromptOptimizationResult["usage"]> | PromptOptimizationResult["usage"] }).usage,
        );
        if (usage?.totalTokens && usage.totalTokens > 0) {
            return usage;
        }

        const inputTokens = this.estimateTokens(inputText);
        const outputTokens = this.estimateTokens(outputText);
        return {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
        };
    }

    private estimateTokens(text: string): number {
        const asciiWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
        const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
        const punctuation = text.match(/[^\sA-Za-z0-9_\u3400-\u9fff]/g)?.length ?? 0;
        return Math.max(1, Math.ceil(asciiWords * 1.3 + cjkChars * 0.8 + punctuation * 0.25));
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

        return {
            apiKey: normalized.apiKey || normalized.api_key || normalized.API_KEY || "",
            baseURL: normalized.baseURL || normalized.baseUrl || normalized.base_url || "",
        };
    }

    private async assertOptimizerModelUsable(modelId: string, label: string) {
        const model = await this.aiModelService.getModelInfo(modelId);
        this.assertModelUsable(model, label);
    }

    private assertModelUsable(model: { modelType?: string; isActive?: boolean; provider?: { isActive?: boolean } }, label: string) {
        if (model.isActive === false || model.provider?.isActive === false) {
            throw HttpErrorFactory.badRequest(`${label}未启用或供应商未启用`);
        }
        if (model.modelType !== "llm") {
            throw HttpErrorFactory.badRequest(`${label}必须选择 LLM 文本模型`);
        }
    }

    private sanitizeText(text: string, maxLength: number): string {
        return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
    }

    private async findExistingRequest(userId?: string, requestKey?: string) {
        if (!userId || !requestKey) return undefined;
        return this.optimizationRepository.findOne({
            where: { userId, requestKey } as FindOptionsWhere<VideoPromptOptimization>,
        });
    }

    private toResult(record: VideoPromptOptimization): PromptOptimizationResult {
        return {
            originalPrompt: record.originalPrompt,
            optimizedPrompt: record.optimizedPrompt,
            source: record.source,
            style: record.style,
            modelId: record.modelId,
            usage: record.usage,
            consumedPower: record.consumedPower,
            warning: record.warning,
        };
    }

    private returnExistingResult(record: VideoPromptOptimization): PromptOptimizationResult {
        if (record.billingStatus === VideoPromptOptimizationBillingStatus.PENDING) {
            throw HttpErrorFactory.badRequest("提示词优化仍在处理中，请稍后重试");
        }
        if (record.billingStatus === VideoPromptOptimizationBillingStatus.FAILED) {
            throw HttpErrorFactory.badRequest(record.warning || "提示词优化失败，请重新提交");
        }
        return this.toResult(record);
    }

    private async createPendingAiRecord(
        prompt: string,
        style: PromptOptimizationStyle,
        modelId: string,
        userId?: string,
        requestKey?: string,
    ) {
        if (!userId) {
            return {
                record: this.optimizationRepository.create({
                    userId: "",
                    requestKey,
                    originalPrompt: prompt,
                    optimizedPrompt: prompt,
                    source: "ai",
                    style,
                    modelId,
                    consumedPower: 0,
                    billingStatus: VideoPromptOptimizationBillingStatus.FREE,
                }),
                reused: false,
            };
        }

        try {
            const record = await this.optimizationRepository.save(
                this.optimizationRepository.create({
                    userId,
                    requestKey,
                    originalPrompt: prompt,
                    optimizedPrompt: prompt,
                    source: "ai",
                    style,
                    modelId,
                    consumedPower: 0,
                    billingStatus: VideoPromptOptimizationBillingStatus.PENDING,
                }),
            );
            return { record, reused: false };
        } catch (error) {
            if (requestKey && this.isUniqueConstraintError(error)) {
                const existing = await this.findExistingRequest(userId, requestKey);
                if (existing) return { record: existing, reused: true };
            }
            throw error;
        }
    }

    private async createFreeOptimizationRecord(
        result: PromptOptimizationResult,
        userId?: string,
        requestKey?: string,
    ) {
        if (!userId) return undefined;

        try {
            const record = await this.optimizationRepository.save(
                this.optimizationRepository.create({
                    userId,
                    requestKey,
                    originalPrompt: result.originalPrompt,
                    optimizedPrompt: result.optimizedPrompt,
                    source: result.source,
                    style: result.style,
                    modelId: result.modelId,
                    usage: result.usage,
                    consumedPower: 0,
                    billingStatus: VideoPromptOptimizationBillingStatus.FREE,
                    warning: result.warning,
                }),
            );
            return { record, reused: false };
        } catch (error) {
            if (requestKey && this.isUniqueConstraintError(error)) {
                const existing = await this.findExistingRequest(userId, requestKey);
                if (existing) return { record: existing, reused: true };
            }
            throw error;
        }
    }

    private async persistAiOptimizationResult(
        recordId: string | undefined,
        result: PromptOptimizationResult,
        fallbackBillingStatus?: VideoPromptOptimizationBillingStatus,
    ) {
        if (!recordId) return;
        const existing = await this.optimizationRepository.findOne({
            where: { id: recordId } as FindOptionsWhere<VideoPromptOptimization>,
        });
        if (!existing) return;

        existing.optimizedPrompt = result.optimizedPrompt;
        existing.source = result.source;
        existing.modelId = result.modelId;
        existing.usage = result.usage;
        existing.warning = result.warning;
        if (result.source === "ai") {
            existing.consumedPower = result.consumedPower ?? existing.consumedPower ?? 0;
            existing.billingStatus = existing.consumedPower > 0
                ? VideoPromptOptimizationBillingStatus.DEDUCTED
                : VideoPromptOptimizationBillingStatus.FREE;
        } else {
            existing.consumedPower = 0;
            existing.billingStatus = fallbackBillingStatus ?? VideoPromptOptimizationBillingStatus.FREE;
        }
        await this.optimizationRepository.save(existing);
    }

    private async deductOptimizationBilling(recordId: string, userId: string, amount: number, modelId: string) {
        await this.optimizationRepository.manager.transaction(async (manager) => {
            const locked = await manager.findOne(VideoPromptOptimization, {
                where: { id: recordId } as FindOptionsWhere<VideoPromptOptimization>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked) {
                throw HttpErrorFactory.notFound("提示词优化记录不存在");
            }
            if (locked.billingStatus === VideoPromptOptimizationBillingStatus.DEDUCTED || await this.hasBillingLog(recordId, ACTION.DEC, manager)) {
                locked.billingStatus = VideoPromptOptimizationBillingStatus.DEDUCTED;
                locked.consumedPower = locked.consumedPower || amount;
                await manager.save(VideoPromptOptimization, locked);
                return;
            }

            await this.billingService.deductUserPower({
                userId,
                amount,
                remark: `Echoflow Video 提示词优化: ${modelId}`,
                associationNo: recordId,
                associationUserId: userId,
            }, manager);
            locked.billingStatus = VideoPromptOptimizationBillingStatus.DEDUCTED;
            locked.consumedPower = amount;
            await manager.save(VideoPromptOptimization, locked);
        });
    }

    private async refundOptimizationBilling(recordId: string | undefined, userId: string | undefined, remark: string) {
        if (!recordId || !userId) return false;
        return this.optimizationRepository.manager.transaction(async (manager) => {
            const locked = await manager.findOne(VideoPromptOptimization, {
                where: { id: recordId } as FindOptionsWhere<VideoPromptOptimization>,
                lock: { mode: "pessimistic_write" },
            });
            if (!locked || !locked.consumedPower || locked.consumedPower <= 0) {
                return false;
            }
            const wasDeducted = locked.billingStatus === VideoPromptOptimizationBillingStatus.DEDUCTED || await this.hasBillingLog(recordId, ACTION.DEC, manager);
            const alreadyRefunded = locked.billingStatus === VideoPromptOptimizationBillingStatus.REFUNDED || await this.hasBillingLog(recordId, ACTION.INC, manager);
            if (!wasDeducted || alreadyRefunded) {
                return false;
            }
            await this.billingService.addUserPower({
                userId,
                amount: locked.consumedPower,
                remark,
                associationNo: recordId,
                associationUserId: userId,
            }, manager);
            locked.consumedPower = 0;
            locked.billingStatus = VideoPromptOptimizationBillingStatus.REFUNDED;
            await manager.save(VideoPromptOptimization, locked);
            return true;
        });
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

    private async markOptimizationFailed(recordId: string, message: string) {
        await this.optimizationRepository.update(recordId, {
            billingStatus: VideoPromptOptimizationBillingStatus.FAILED,
            warning: message,
        });
    }

    private isInsufficientPowerError(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("积分不足");
    }

    private isUniqueConstraintError(error: unknown) {
        const code = (error as { code?: string }).code;
        return code === "23505";
    }
}
