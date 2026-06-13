import { generateText } from "@buildingai/ai-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
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
    ) {}

    async optimize(dto: OptimizePromptDto, userId?: string): Promise<PromptOptimizationResult> {
        const existing = await this.findExistingRequest(userId, dto.requestKey);
        if (existing) {
            return this.toResult(existing);
        }

        const config = await this.providerConfigService.getConsoleConfig();
        if (config.promptOptimizerEnabled === false) {
            throw HttpErrorFactory.badRequest("提示词优化已在管理后台关闭");
        }

        const prompt = this.sanitizeText(dto.prompt, 2000);
        const style = dto.style ?? "cinematic";
        const modelId = this.resolveOptimizerModelId(
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
            await this.persistOptimizationResult(result, userId, dto.requestKey);
            return result;
        }

        try {
            const result = await this.aiOptimize(modelId, prompt, style, dto, userId, config);
            const response: PromptOptimizationResult = {
                originalPrompt: prompt,
                optimizedPrompt: result.optimizedPrompt,
                source: "ai",
                style,
                modelId,
                usage: result.usage,
                consumedPower: result.consumedPower,
            };
            await this.persistOptimizationResult(response, userId, dto.requestKey, config);
            return response;
        } catch (error) {
            const warning = error instanceof Error ? error.message : "提示词优化模型调用失败";
            this.logger.warn(`Prompt optimization fell back to local mode: ${warning}`);
            const result: PromptOptimizationResult = {
                originalPrompt: prompt,
                optimizedPrompt: this.localOptimize(prompt, style, dto),
                source: "local",
                style,
                modelId,
                warning: "AI 优化模型暂不可用，已使用本地规则优化",
            };
            await this.persistOptimizationResult(result, userId, dto.requestKey);
            return result;
        }
    }

    private async aiOptimize(
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
        if (
            config.promptOptimizerBillingEnabled !== false &&
            userId &&
            estimatedPower > 0 &&
            !(await this.billingService.hasSufficientPower(userId, estimatedPower))
        ) {
            throw HttpErrorFactory.badRequest("积分不足，请充值后重试");
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
        const consumedPower =
            config.promptOptimizerBillingEnabled === false || !userId
                ? 0
                : this.calculateConsumedPower(
                    usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
                    billingRule,
                );

        return {
            optimizedPrompt: this.normalizeOptimizedPrompt(result.text, prompt),
            usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
            },
            consumedPower,
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

        return {
            enabled: config.promptOptimizerEnabled !== false,
            defaultModelId: config.promptOptimizerModelId || undefined,
            billingEnabled: config.promptOptimizerBillingEnabled !== false,
            models: models.filter(Boolean),
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

    private resolveOptimizerModelId(
        requestedModelId: string | undefined,
        defaultModelId: string | undefined,
        allowedModelIds: string[] | undefined,
    ): string | undefined {
        const allowed = this.resolveAllowedModelIds(defaultModelId, allowedModelIds);
        const requested = requestedModelId?.trim();
        if (requested) {
            if (!allowed.includes(requested)) {
                throw HttpErrorFactory.badRequest("所选提示词优化模型未在管理后台开放");
            }
            return requested;
        }
        return defaultModelId?.trim() || allowed[0];
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

    private async persistOptimizationResult(
        result: PromptOptimizationResult,
        userId?: string,
        requestKey?: string,
        config?: Awaited<ReturnType<ProviderConfigService["getConsoleConfig"]>>,
    ) {
        if (!userId) return;

        const record = this.optimizationRepository.create({
            userId,
            requestKey,
            originalPrompt: result.originalPrompt,
            optimizedPrompt: result.optimizedPrompt,
            source: result.source,
            style: result.style,
            modelId: result.modelId,
            usage: result.usage,
            consumedPower: result.consumedPower ?? 0,
            billingStatus:
                result.consumedPower && result.consumedPower > 0
                    ? VideoPromptOptimizationBillingStatus.FAILED
                    : VideoPromptOptimizationBillingStatus.FREE,
            warning: result.warning,
        });

        if (!result.consumedPower || result.consumedPower <= 0 || config?.promptOptimizerBillingEnabled === false) {
            await this.optimizationRepository.save({
                ...record,
                consumedPower: 0,
                billingStatus: VideoPromptOptimizationBillingStatus.FREE,
            });
            result.consumedPower = 0;
            return;
        }

        const saved = await this.optimizationRepository.manager.transaction(async (manager) => {
            const persisted = await manager.save(VideoPromptOptimization, record);
            await this.billingService.deductUserPower({
                userId,
                amount: result.consumedPower ?? 0,
                remark: `Echoflow Video 提示词优化: ${result.modelId}`,
                associationNo: persisted.id,
                associationUserId: userId,
            }, manager);
            persisted.billingStatus = VideoPromptOptimizationBillingStatus.DEDUCTED;
            return manager.save(VideoPromptOptimization, persisted);
        });

        result.consumedPower = saved.consumedPower;
    }
}
