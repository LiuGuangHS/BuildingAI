import { BaseService } from "@buildingai/base";
import { MODEL_TYPES } from "@buildingai/ai-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { AiModel } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { maskSensitiveValue } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { encryptApiKey, decryptApiKey } from "../../../common/crypto/encryption";
import { PromptTemplate, VideoProviderConfig } from "../../../db/entities/video-provider-config.entity";
import { VideoConfigAudit } from "../../../db/entities/video-config-audit.entity";
import { UpdateProviderConfigDto } from "../dto";

const HAPPYHORSE_PROVIDER = "happyhorse";

@Injectable()
export class ProviderConfigService extends BaseService<VideoProviderConfig> {
    constructor(
        @InjectRepository(VideoProviderConfig)
        private readonly configRepository: Repository<VideoProviderConfig>,
        @InjectRepository(VideoConfigAudit)
        private readonly auditRepository: Repository<VideoConfigAudit>,
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        private readonly aiModelService: PublicAiModelService,
    ) {
        super(configRepository);
    }

    async getConsoleConfig() {
        const config = await this.findHappyHorseConfig();
        if (!config) {
            return {
                provider: HAPPYHORSE_PROVIDER,
                enabled: false,
                webhookSecretConfigured: false,
                webhookSecretMasked: "",
                promptOptimizerEnabled: true,
                promptOptimizerModelId: "",
                promptOptimizerAllowedModelIds: [],
                promptOptimizerBillingEnabled: true,
                promptOptimizerBillingPower: 1,
                promptOptimizerBillingTokens: 1000,
                promptOptimizerEstimatedTokens: 500,
            };
        }

        const webhookSecret = this.decryptOptional(config.webhookSecret);
        return {
            provider: config.provider,
            enabled: config.enabled,
            webhookSecretConfigured: Boolean(webhookSecret),
            webhookSecretMasked: webhookSecret ? maskSensitiveValue(webhookSecret) : "",
            promptOptimizerEnabled: config.promptOptimizerEnabled ?? true,
            promptOptimizerModelId: config.promptOptimizerModelId ?? "",
            promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
            promptOptimizerBillingEnabled: config.promptOptimizerBillingEnabled ?? true,
            promptOptimizerBillingPower: config.promptOptimizerBillingPower ?? 1,
            promptOptimizerBillingTokens: config.promptOptimizerBillingTokens ?? 1000,
            promptOptimizerEstimatedTokens: config.promptOptimizerEstimatedTokens ?? 500,
            templates: config.templates || [],
            updatedAt: config.updatedAt,
        };
    }

    async getPublicTemplates() {
        const config = await this.findHappyHorseConfig();
        if (!config?.templates?.length) return [];
        return config.templates;
    }

    async getPublicStatus() {
        return {
            available: true,
            configured: true,
            enabled: true,
        };
    }

    async updateConsoleConfig(dto: UpdateProviderConfigDto, operatorId?: string) {
        const existing = await this.findHappyHorseConfig();
        const config = existing ?? this.configRepository.create({ provider: HAPPYHORSE_PROVIDER });

        if (dto.clearWebhookSecret) {
            config.webhookSecret = undefined;
        } else if (dto.webhookSecret) {
            config.webhookSecret = encryptApiKey(dto.webhookSecret);
        }
        config.promptOptimizerEnabled =
            dto.promptOptimizerEnabled ?? config.promptOptimizerEnabled ?? true;
        if (dto.clearPromptOptimizerModelId) {
            config.promptOptimizerModelId = undefined;
        } else if (dto.promptOptimizerModelId !== undefined) {
            config.promptOptimizerModelId = dto.promptOptimizerModelId;
        }
        if (config.promptOptimizerModelId) {
            await this.assertPromptOptimizerModelUsable(config.promptOptimizerModelId, "默认提示词优化模型");
        }
        if (dto.promptOptimizerAllowedModelIds) {
            config.promptOptimizerAllowedModelIds = this.normalizeModelIds(dto.promptOptimizerAllowedModelIds);
        }
        await this.assertPromptOptimizerModelsUsable(config.promptOptimizerAllowedModelIds ?? []);
        config.promptOptimizerBillingEnabled =
            dto.promptOptimizerBillingEnabled ?? config.promptOptimizerBillingEnabled ?? true;
        config.promptOptimizerBillingPower = this.normalizeInteger(
            dto.promptOptimizerBillingPower ?? config.promptOptimizerBillingPower ?? 1,
            1,
            100000,
            "提示词优化兜底算力",
        );
        config.promptOptimizerBillingTokens = this.normalizeInteger(
            dto.promptOptimizerBillingTokens ?? config.promptOptimizerBillingTokens ?? 1000,
            1,
            1000000,
            "提示词优化兜底 tokens",
        );
        config.promptOptimizerEstimatedTokens = this.normalizeInteger(
            dto.promptOptimizerEstimatedTokens ?? config.promptOptimizerEstimatedTokens ?? 500,
            50,
            20000,
            "提示词优化预检 tokens",
        );
        config.enabled = dto.enabled ?? config.enabled ?? true;
        if (dto.templates) {
            config.templates = this.normalizeTemplates(dto.templates);
        }
        await this.configRepository.save(config);
        await this.writeAudit("provider_config_updated", config, operatorId);
        return this.getConsoleConfig();
    }

    async clearConsoleConfig(operatorId?: string) {
        const existing = await this.findHappyHorseConfig();
        if (existing) {
            await this.configRepository.delete(existing.id);
            await this.writeAudit("provider_config_cleared", existing, operatorId);
        }
        return this.getConsoleConfig();
    }

    async listAudits(limit = 50) {
        const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
        return this.auditRepository.find({
            order: { createdAt: "DESC" },
            take,
        });
    }

    async listPromptOptimizerModels() {
        const models = await this.aiModelRepository.find({
            where: { modelType: MODEL_TYPES.LLM, isActive: true } as FindOptionsWhere<AiModel>,
            relations: ["provider"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
            take: 100,
        });

        return models
            .filter((model) => model.provider?.isActive !== false)
            .map((model) => ({
                id: model.id,
                name: model.name,
                model: model.model,
                modelType: model.modelType,
                description: model.description,
                features: model.features ?? [],
                isActive: model.isActive,
                billingRule: model.billingRule,
                provider: model.provider
                    ? {
                        id: model.provider.id,
                        name: model.provider.name,
                        provider: model.provider.provider,
                        isActive: model.provider.isActive,
                    }
                    : undefined,
            }));
    }

    async verifyHappyHorseWebhookSecret(secret?: string): Promise<boolean> {
        const config = await this.findHappyHorseConfig();
        const expectedSecret = this.decryptOptional(config?.webhookSecret);
        if (!expectedSecret) {
            return false;
        }
        return Boolean(secret && secret === expectedSecret);
    }

    private findHappyHorseConfig() {
        return this.configRepository.findOne({
            where: { provider: HAPPYHORSE_PROVIDER } as FindOptionsWhere<VideoProviderConfig>,
        });
    }

    private normalizeTemplates(templates: PromptTemplate[]): PromptTemplate[] {
        return templates
            .map((template) => ({
                label: template.label.trim().slice(0, 80),
                prompt: template.prompt.trim().slice(0, 1000),
            }))
            .filter((template) => template.label && template.prompt);
    }

    private normalizeModelIds(modelIds: string[]): string[] {
        return Array.from(
            new Set(
                modelIds
                    .map((modelId) => modelId.trim())
                    .filter(Boolean),
            ),
        );
    }

    private normalizeInteger(value: number, min: number, max: number, label: string): number {
        if (!Number.isInteger(value) || value < min || value > max) {
            throw HttpErrorFactory.badRequest(`${label}必须是 ${min} 到 ${max} 之间的整数`);
        }
        return value;
    }

    private async assertPromptOptimizerModelsUsable(modelIds: string[]): Promise<void> {
        for (const modelId of modelIds) {
            await this.assertPromptOptimizerModelUsable(modelId, "提示词优化模型池");
        }
    }

    private async assertPromptOptimizerModelUsable(modelId: string, label: string): Promise<void> {
        let model: Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>;
        try {
            model = await this.aiModelService.getModelInfo(modelId);
        } catch {
            throw HttpErrorFactory.badRequest(`${label}不存在`);
        }
        if (model.isActive === false || model.provider?.isActive === false) {
            throw HttpErrorFactory.badRequest(`${label}未启用或供应商未启用`);
        }
        if (model.modelType !== "llm") {
            throw HttpErrorFactory.badRequest(`${label}必须选择 LLM 文本模型`);
        }
    }

    private decryptOptional(value?: string | null): string {
        return value ? decryptApiKey(value) : "";
    }

    private async writeAudit(action: string, config: VideoProviderConfig, operatorId?: string): Promise<void> {
        await this.auditRepository.save(
            this.auditRepository.create({
                action,
                operatorId,
                snapshot: {
                    provider: config.provider,
                    enabled: config.enabled,
                    webhookSecretConfigured: Boolean(config.webhookSecret),
                    promptOptimizerEnabled: config.promptOptimizerEnabled,
                    promptOptimizerModelId: config.promptOptimizerModelId,
                    promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
                    promptOptimizerBillingEnabled: config.promptOptimizerBillingEnabled,
                    promptOptimizerBillingPower: config.promptOptimizerBillingPower,
                    promptOptimizerBillingTokens: config.promptOptimizerBillingTokens,
                    promptOptimizerEstimatedTokens: config.promptOptimizerEstimatedTokens,
                },
            }),
        );
    }
}
