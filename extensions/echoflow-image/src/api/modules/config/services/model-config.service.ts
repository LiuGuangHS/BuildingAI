import { BaseService } from "@buildingai/base";
import { MODEL_TYPES } from "@buildingai/ai-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { buildWhere } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { ImageBillingRule } from "../../../db/entities/image-billing-rule.entity";
import { ImageGeneration } from "../../../db/entities/image-generation.entity";
import {
    ImageApiMode,
    ImageModelConfig,
    ImageRequestPolicy,
    ImageResponsesTransport,
    type ImageModelAllowedParams,
    type ImageModelCapabilities,
    type ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../../db/entities/image-policy-config.entity";
import { CreateModelConfigDto, QueryAvailableAiModelDto, QueryModelConfigDto, UpdateModelConfigDto } from "../dto";

const DEFAULT_CAPABILITIES: ImageModelCapabilities = {
    textToImage: true,
    imageToImage: false,
    mask: false,
    multiReference: false,
    seed: false,
    negativePrompt: true,
    outputFormat: false,
    background: false,
    moderation: false,
    inputFidelity: false,
};

const DEFAULT_PARAMS: ImageModelDefaultParams = {
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
    n: 1,
    responseFormat: "b64_json",
};

const DEFAULT_ALLOWED_PARAMS: ImageModelAllowedParams = {
    sizes: ["1024x1024", "1024x1792", "1792x1024"],
    qualities: ["standard", "hd"],
    styles: ["vivid", "natural"],
    maxImages: 4,
};

@Injectable()
export class ModelConfigService extends BaseService<ImageModelConfig> {
    constructor(
        @InjectRepository(ImageModelConfig)
        private readonly modelConfigRepository: Repository<ImageModelConfig>,
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        @InjectRepository(ImageBillingRule)
        private readonly billingRuleRepository: Repository<ImageBillingRule>,
        @InjectRepository(ImagePolicyConfig)
        private readonly policyRepository: Repository<ImagePolicyConfig>,
        @InjectRepository(ImageGeneration)
        private readonly generationRepository: Repository<ImageGeneration>,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryModelConfigDto) {
        const where = buildWhere<ImageModelConfig>({
            displayName: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            enabled: query.enabled,
        });

        return this.paginate(query, {
            where,
            relations: ["aiModel", "aiModel.provider"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
    }

    async listEnabledForWeb() {
        const [configs, imageModels] = await Promise.all([
            this.modelConfigRepository.find({
                where: { enabled: true } as FindOptionsWhere<ImageModelConfig>,
                relations: ["aiModel", "aiModel.provider"],
                order: { sortOrder: "DESC", createdAt: "DESC" },
            }),
            this.aiModelRepository.find({
                where: { modelType: MODEL_TYPES.TEXT_TO_IMAGE, isActive: true } as FindOptionsWhere<AiModel>,
                relations: ["provider"],
                order: { sortOrder: "DESC", createdAt: "DESC" },
            }),
        ]);

        const configuredModelIds = new Set(configs.map((config) => config.aiModelId));
        const configuredOptions = configs
            .filter((config) => this.isConfigUsable(config))
            .map((config) => this.toWebOption(config));
        const mainSystemOptions = imageModels
            .filter((model) => !configuredModelIds.has(model.id))
            .filter((model) => this.isAiModelUsableForImage(model))
            .map((model) => this.toWebOptionFromAiModel(model));

        return [...configuredOptions, ...mainSystemOptions];
    }

    async listAvailableAiModels(query: QueryAvailableAiModelDto) {
        const baseWhere = buildWhere<AiModel>({
            isActive: query.activeOnly ? true : undefined,
        });
        const where = query.keyword
            ? [
                { ...baseWhere, name: Like(`%${query.keyword}%`) },
                { ...baseWhere, model: Like(`%${query.keyword}%`) },
                { ...baseWhere, description: Like(`%${query.keyword}%`) },
            ]
            : baseWhere;

        const [models, configured] = await Promise.all([
            this.aiModelRepository.find({
                where,
                relations: ["provider"],
                order: { sortOrder: "DESC", createdAt: "DESC" },
                take: 100,
            }),
            this.modelConfigRepository.find({ select: ["aiModelId"] }),
        ]);
        const configuredIds = new Set(configured.map((item) => item.aiModelId));

        return models
            .filter((model) => !query.activeOnly || model.provider?.isActive !== false)
            .filter((model) => !query.imageOnly || this.looksLikeImageModel(model))
            .map((model) => ({
                id: model.id,
                name: model.name,
                model: model.model,
                modelType: model.modelType,
                description: model.description,
                features: model.features ?? [],
                isActive: model.isActive,
                configured: configuredIds.has(model.id),
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

    async findEnabledById(id: string) {
        const config = await this.modelConfigRepository.findOne({
            where: { id, enabled: true } as FindOptionsWhere<ImageModelConfig>,
            relations: ["aiModel", "aiModel.provider"],
        });

        if (!config || !this.isConfigUsable(config)) {
            throw HttpErrorFactory.badRequest("所选图片模型未启用或不可用");
        }

        return config;
    }

    async findEnabledConfigByModelId(aiModelId: string) {
        const config = await this.modelConfigRepository.findOne({
            where: { aiModelId, enabled: true } as FindOptionsWhere<ImageModelConfig>,
            relations: ["aiModel", "aiModel.provider"],
        });

        if (!config || !this.isConfigUsable(config)) {
            return undefined;
        }

        return config;
    }

    async findEnabledImageModelById(id: string) {
        const model = await this.aiModelRepository.findOne({
            where: { id, modelType: MODEL_TYPES.TEXT_TO_IMAGE, isActive: true } as FindOptionsWhere<AiModel>,
            relations: ["provider"],
        });

        if (!model || !this.isAiModelUsableForImage(model)) {
            throw HttpErrorFactory.badRequest("所选主站生图模型未启用或不可用");
        }

        return model;
    }

    async findWebOptionById(id: string) {
        const config = await this.modelConfigRepository.findOne({
            where: { id, enabled: true } as FindOptionsWhere<ImageModelConfig>,
            relations: ["aiModel", "aiModel.provider"],
        });

        if (config && this.isConfigUsable(config)) {
            return this.toWebOption(config);
        }

        const model = await this.findEnabledImageModelById(id);
        const modelConfig = await this.findEnabledConfigByModelId(model.id);
        return modelConfig ? this.toWebOption(modelConfig) : this.toWebOptionFromAiModel(model);
    }

    async findByIdOrFail(id: string) {
        const config = await this.modelConfigRepository.findOne({
            where: { id } as FindOptionsWhere<ImageModelConfig>,
            relations: ["aiModel", "aiModel.provider"],
        });

        if (!config) {
            throw HttpErrorFactory.notFound("图片模型配置不存在");
        }

        return config;
    }

    async createConfig(dto: CreateModelConfigDto) {
        await this.assertAiModelExists(dto.aiModelId);

        const existing = await this.modelConfigRepository.findOne({
            where: { aiModelId: dto.aiModelId } as FindOptionsWhere<ImageModelConfig>,
        });
        if (existing) {
            throw HttpErrorFactory.badRequest("该主系统模型已经配置为绘画模型");
        }

        return this.modelConfigRepository.save(
            this.modelConfigRepository.create(this.normalizeConfig(dto)),
        );
    }

    async updateConfig(id: string, dto: UpdateModelConfigDto) {
        const config = await this.findByIdOrFail(id);

        if (dto.aiModelId && dto.aiModelId !== config.aiModelId) {
            await this.assertAiModelExists(dto.aiModelId);
            await this.assertAiModelNotConfigured(dto.aiModelId, id);
        }

        Object.assign(config, this.normalizeConfig(dto, config));
        return this.modelConfigRepository.save(config);
    }

    async deleteConfig(id: string) {
        await this.findByIdOrFail(id);
        const [billingRules, policies, generations] = await Promise.all([
            this.billingRuleRepository.count({ where: { modelConfigId: id } as FindOptionsWhere<ImageBillingRule> }),
            this.policyRepository.count({ where: { modelConfigId: id } as FindOptionsWhere<ImagePolicyConfig> }),
            this.generationRepository.count({ where: { modelConfigId: id } as FindOptionsWhere<ImageGeneration> }),
        ]);

        if (billingRules || policies || generations) {
            throw HttpErrorFactory.badRequest("该模型配置已有计费、策略或生成历史引用，请先停用而不是删除");
        }
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async testConfig(id: string) {
        const config = await this.findByIdOrFail(id);
        return {
            success: this.isConfigUsable(config),
            model: config.aiModel?.model,
            provider: config.aiModel?.provider?.provider,
            message: this.isConfigUsable(config) ? "模型配置可用" : "模型或供应商未启用",
        };
    }

    toWebOption(config: ImageModelConfig) {
        const capabilities = this.normalizeCapabilities(config.capabilities);
        return {
            id: config.aiModelId,
            pluginConfigId: config.id,
            aiModelId: config.aiModelId,
            name: config.displayName,
            model: config.aiModel?.model,
            modelType: config.aiModel?.modelType,
            provider: config.aiModel?.provider?.provider,
            providerName: config.aiModel?.provider?.name,
            apiMode: config.apiMode,
            requestPolicy: config.requestPolicy,
            capabilities,
            defaultParams: this.normalizeDefaultParams(config.defaultParams, capabilities),
            allowedParams: this.normalizeAllowedParams(config.allowedParams, capabilities),
            features: config.aiModel?.features ?? [],
            source: "plugin-config",
        };
    }

    toWebOptionFromAiModel(model: AiModel) {
        return {
            id: model.id,
            aiModelId: model.id,
            name: model.name,
            model: model.model,
            modelType: model.modelType,
            provider: model.provider?.provider,
            providerName: model.provider?.name,
            apiMode: ImageApiMode.IMAGES,
            requestPolicy: ImageRequestPolicy.OPENAI,
            capabilities: DEFAULT_CAPABILITIES,
            defaultParams: DEFAULT_PARAMS,
            allowedParams: DEFAULT_ALLOWED_PARAMS,
            features: model.features ?? [],
            source: "main-system",
        };
    }

    private normalizeCapabilities(capabilities?: ImageModelCapabilities): ImageModelCapabilities {
        return {
            ...DEFAULT_CAPABILITIES,
            ...(capabilities ?? {}),
        };
    }

    private normalizeDefaultParams(
        defaultParams?: ImageModelDefaultParams,
        capabilities?: ImageModelCapabilities,
    ): ImageModelDefaultParams {
        const normalizedCapabilities = this.normalizeCapabilities(capabilities);
        const normalized = {
            ...DEFAULT_PARAMS,
            ...(defaultParams ?? {}),
        };
        if (!normalizedCapabilities.outputFormat) {
            delete normalized.outputFormat;
        }
        return normalized;
    }

    private normalizeAllowedParams(
        allowedParams?: ImageModelAllowedParams,
        capabilities?: ImageModelCapabilities,
    ): ImageModelAllowedParams {
        const normalizedCapabilities = this.normalizeCapabilities(capabilities);
        const normalized = {
            ...DEFAULT_ALLOWED_PARAMS,
            ...(allowedParams ?? {}),
        };
        if (!normalizedCapabilities.outputFormat) {
            delete normalized.outputFormats;
        }
        return normalized;
    }

    private normalizeConfig(
        dto: CreateModelConfigDto | UpdateModelConfigDto,
        existing?: ImageModelConfig,
    ) {
        return {
            ...dto,
            enabled: dto.enabled ?? existing?.enabled ?? true,
            apiMode: dto.apiMode ?? existing?.apiMode ?? ImageApiMode.IMAGES,
            responsesTransport:
                dto.responsesTransport ?? existing?.responsesTransport ?? ImageResponsesTransport.SSE,
            requestPolicy: dto.requestPolicy ?? existing?.requestPolicy ?? ImageRequestPolicy.OPENAI,
            capabilities: {
                ...DEFAULT_CAPABILITIES,
                ...(existing?.capabilities ?? {}),
                ...(dto.capabilities ?? {}),
            },
            defaultParams: {
                ...DEFAULT_PARAMS,
                ...(existing?.defaultParams ?? {}),
                ...(dto.defaultParams ?? {}),
            },
            allowedParams: {
                ...DEFAULT_ALLOWED_PARAMS,
                ...(existing?.allowedParams ?? {}),
                ...(dto.allowedParams ?? {}),
            },
            sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
        };
    }

    private async assertAiModelExists(aiModelId: string) {
        const model = await this.aiModelRepository.findOne({
            where: { id: aiModelId } as FindOptionsWhere<AiModel>,
            relations: ["provider"],
        });
        if (!model) {
            throw HttpErrorFactory.badRequest("主系统模型不存在");
        }
        if (!this.isAiModelUsableForImage(model)) {
            throw HttpErrorFactory.badRequest("请选择已启用且支持图片能力的主系统模型");
        }
    }

    private async assertAiModelNotConfigured(aiModelId: string, ignoreConfigId?: string) {
        const existing = await this.modelConfigRepository.findOne({
            where: { aiModelId } as FindOptionsWhere<ImageModelConfig>,
        });
        if (existing && existing.id !== ignoreConfigId) {
            throw HttpErrorFactory.badRequest("该主系统模型已经配置为绘画模型");
        }
    }

    private isConfigUsable(config: ImageModelConfig) {
        return config.enabled && Boolean(config.aiModel) && this.isAiModelUsableForImage(config.aiModel);
    }

    private looksLikeImageModel(model: AiModel) {
        if (model.modelType === MODEL_TYPES.TEXT_TO_IMAGE) {
            return true;
        }
        const fields = [model.modelType, model.model, model.name, ...(model.features ?? [])]
            .filter(Boolean)
            .map((item) => String(item).toLowerCase());
        return fields.some((item) => item.includes("image") || item.includes("dall") || item.includes("gpt-image"));
    }

    private isAiModelUsableForImage(model: AiModel) {
        return model.isActive !== false && model.provider?.isActive !== false && this.looksLikeImageModel(model);
    }
}
