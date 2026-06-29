import { BaseProviderSettings, experimental_generateVideo, generateImage, generateTextWithUsage, getProvider, type ModelType } from "@buildingai/ai-sdk";
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
type GenerateImageParams = Parameters<typeof generateImage>[0];
export type PublicAiGenerateImageParams = Omit<GenerateImageParams, "model">;
export type PublicAiGenerateImageResult = Awaited<ReturnType<typeof generateImage>>;
type GenerateVideoParams = Parameters<typeof experimental_generateVideo>[0];
export type PublicAiGenerateVideoParams = Omit<GenerateVideoParams, "model">;
export type PublicAiGenerateVideoResult = Awaited<ReturnType<typeof experimental_generateVideo>>;

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

    async listActiveModelsByType(modelType: ModelType, take = 100) {
        const models = await this.aiModelRepository.find({
            where: { modelType, isActive: true },
            relations: ["provider"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
            take: Math.min(Math.max(Number(take) || 100, 1), 200),
        });

        return models.filter((model) => model.provider?.isActive !== false);
    }

    async listActiveLlmModels(take = 100) {
        return this.listActiveModelsByType("llm", take);
    }

    async listActiveImageModels(take = 100) {
        return this.listActiveModelsByType("text-to-image", take);
    }

    async listActiveVideoModels(take = 100) {
        return this.listActiveModelsByType("text-to-video", take);
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

    private async getUsableModelProvider(modelId: string) {
        const model = await this.getModelInfo(modelId);
        const providerConfig = normalizeProviderConfig(await this.getProviderConfig(modelId));
        const provider = getProvider(model.provider.provider, providerConfig);
        return { model, provider };
    }

    async generateText(modelId: string, params: PublicAiGenerateTextParams): Promise<PublicAiGenerateTextResult> {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (!provider.supports("language")) {
            throw new Error("The ai model does not support text generation.");
        }

        const request = {
            ...params,
            model: provider(model.model).model,
        } as GenerateTextWithUsageParams;

        return generateTextWithUsage(request, { model: model.model });
    }

    async generateImage(modelId: string, params: PublicAiGenerateImageParams): Promise<PublicAiGenerateImageResult> {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (model.modelType !== "text-to-image") {
            throw new Error("The ai model is not a text-to-image model.");
        }
        if (!provider.supports("image")) {
            throw new Error("The ai model provider does not support image generation.");
        }

        return generateImage({
            ...params,
            model: provider.image(model.model).model,
        });
    }

    async generateVideo(modelId: string, params: PublicAiGenerateVideoParams): Promise<PublicAiGenerateVideoResult> {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (model.modelType !== "text-to-video") {
            throw new Error("The ai model is not a text-to-video model.");
        }
        if (!provider.supports("video")) {
            throw new Error("The ai model provider does not support video generation.");
        }

        return experimental_generateVideo({
            ...params,
            model: provider.video(model.model).model,
        });
    }
}
