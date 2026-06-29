import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { Injectable } from "@nestjs/common";

import { VideoProviderConfig } from "../../../db/entities/video-provider-config.entity";
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
        private readonly aiModelService: PublicAiModelService,
    ) {
        super(configRepository);
    }

    async getConsoleConfig() {
        const config = await this.findHappyHorseConfig();
        if (!config) {
            return {
                provider: HAPPYHORSE_PROVIDER,
                promptOptimizerEnabled: true,
                promptOptimizerModelId: "",
                promptOptimizerAllowedModelIds: [],
            };
        }

        return {
            provider: config.provider,
            promptOptimizerEnabled: config.promptOptimizerEnabled ?? true,
            promptOptimizerModelId: config.promptOptimizerModelId ?? "",
            promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
            updatedAt: config.updatedAt,
        };
    }

    async updateConsoleConfig(dto: UpdateProviderConfigDto, operatorId?: string) {
        const existing = await this.findHappyHorseConfig();
        const config = existing ?? this.configRepository.create({ provider: HAPPYHORSE_PROVIDER });

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
        const models = await this.aiModelService.listActiveLlmModels(100);

        return models.map((model) => ({
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

    private findHappyHorseConfig() {
        return this.configRepository.findOne({
            where: { provider: HAPPYHORSE_PROVIDER } as FindOptionsWhere<VideoProviderConfig>,
        });
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

    private async writeAudit(action: string, config: VideoProviderConfig, operatorId?: string): Promise<void> {
        await this.auditRepository.save(
            this.auditRepository.create({
                action,
                operatorId,
                snapshot: {
                    provider: config.provider,
                    promptOptimizerEnabled: config.promptOptimizerEnabled,
                    promptOptimizerModelId: config.promptOptimizerModelId,
                    promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
                },
            }),
        );
    }
}
