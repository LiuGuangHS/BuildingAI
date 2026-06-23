import { BaseProviderSettings, generateTextWithUsage, getProvider } from "@buildingai/ai-sdk";
import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, Secret } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";

import { normalizeProviderConfig } from "../provider-config";

type GenerateTextWithUsageParams = Parameters<typeof generateTextWithUsage>[0];
export type PublicAiGenerateTextParams = GenerateTextWithUsageParams extends infer T
    ? T extends unknown
        ? Omit<T, "model">
        : never
    : never;
export type PublicAiGenerateTextResult = Awaited<ReturnType<typeof generateTextWithUsage>>;

/**
 * Public AI Model Service
 */
@Injectable()
export class PublicAiModelService {
    protected readonly logger = new Logger(PublicAiModelService.name);
    private readonly baseService: BaseService<AiModel>;

    constructor(
        @InjectRepository(AiModel)
        protected readonly aiModelRepository: Repository<AiModel>,
        @InjectRepository(Secret)
        protected readonly secretRepository: Repository<Secret>,
        private readonly secretService: SecretService,
    ) {
        this.baseService = new BaseService(aiModelRepository);
    }

    async getModelInfo(modelId: string) {
        const model = await this.baseService.findOneById(modelId, {
            relations: ["provider"],
        });

        if (!model) {
            throw new Error("The ai model is not found.");
        }

        return model;
    }

    async listActiveLlmModels(take = 100) {
        const models = await this.aiModelRepository.find({
            where: { modelType: "llm", isActive: true },
            relations: ["provider"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
            take: Math.min(Math.max(Number(take) || 100, 1), 200),
        });

        return models.filter((model) => model.provider?.isActive !== false);
    }

    /**
     * Get provider config
     * @param modelId AI model identifier
     * @returns Provider config
     */
    async getProviderConfig(modelId: string) {
        const model = await this.getModelInfo(modelId);

        if (!model.provider.bindSecretId) {
            throw new Error("The ai model is not bound to a secret.");
        }

        const secretConfig = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );

        return secretConfig;
    }

    /**
     * Get provider
     * @param modelId AI model identifier
     * @param configKeys Config keys
     * @returns Provider
     */
    async getProviderAdapter(modelId: string, config: BaseProviderSettings = {}) {
        const model = await this.getModelInfo(modelId);
        const provider = getProvider(model.provider.provider, config);
        return provider;
    }

    async generateText(modelId: string, params: PublicAiGenerateTextParams): Promise<PublicAiGenerateTextResult> {
        const model = await this.getModelInfo(modelId);
        const providerConfig = normalizeProviderConfig(await this.getProviderConfig(modelId));
        const provider = getProvider(model.provider.provider, providerConfig);
        if (!provider.supports("language")) {
            throw new Error("The ai model does not support text generation.");
        }

        const request = {
            ...params,
            model: provider(model.model).model,
        } as GenerateTextWithUsageParams;

        return generateTextWithUsage(request, { model: model.model });
    }
}
