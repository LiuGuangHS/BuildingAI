import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { Injectable } from "@nestjs/common";

import { ImageBillingRule } from "../../../db/entities/image-billing-rule.entity";
import { ImageGeneration } from "../../../db/entities/image-generation.entity";
import {
    ImageModelConfig,
    type ImageModelAllowedParams,
    type ImageModelCapabilities,
    type ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../../db/entities/image-policy-config.entity";
import { CreateModelConfigDto, QueryModelConfigDto, UpdateModelConfigDto } from "../dto";

export interface ResolvedImageModelConfig {
    id: string;
    mainModelId: string;
    promptEnhancerModelId?: string | null;
    provider: string;
    providerName: string;
    model: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: ImageModelCapabilities;
    defaultParams: ImageModelDefaultParams;
    allowedParams: ImageModelAllowedParams;
    sortOrder: number;
}

const DEFAULT_CAPABILITIES: ImageModelCapabilities = {
    textToImage: true,
    imageToImage: false,
    mask: false,
    multiReference: false,
    seed: false,
    negativePrompt: false,
    outputFormat: true,
    background: false,
    moderation: false,
    inputFidelity: false,
};

const DEFAULT_PARAMS: ImageModelDefaultParams = {
    size: "1024x1024",
    quality: "standard",
    n: 1,
    responseFormat: "b64_json",
    outputFormat: "png",
};

const DEFAULT_ALLOWED_PARAMS: ImageModelAllowedParams = {
    sizes: ["1024x1024", "1024x1536", "1536x1024"],
    qualities: ["standard", "hd"],
    styles: ["vivid", "natural"],
    outputFormats: ["png", "jpeg", "webp"],
    maxImages: 1,
};

@Injectable()
export class ModelConfigService extends BaseService<ImageModelConfig> {
    private schemaReadyPromise?: Promise<void>;

    constructor(
        @InjectRepository(ImageModelConfig)
        private readonly modelConfigRepository: Repository<ImageModelConfig>,
        @InjectRepository(ImageBillingRule)
        private readonly billingRuleRepository: Repository<ImageBillingRule>,
        @InjectRepository(ImagePolicyConfig)
        private readonly policyRepository: Repository<ImagePolicyConfig>,
        @InjectRepository(ImageGeneration)
        private readonly generationRepository: Repository<ImageGeneration>,
        private readonly publicAiModelService: PublicAiModelService,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryModelConfigDto) {
        const page = Math.max(Number(query.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
        const keyword = query.keyword?.trim().toLowerCase();
        const configsByModelId = await this.getConfigsByMainModelId();
        const items = (await this.publicAiModelService.listActiveImageModels(200))
            .map((model) => this.toOperationalView(configsByModelId.get(model.id), model))
            .filter((item) => query.enabled === undefined || item.enabled === query.enabled)
            .filter((item) => {
                if (!keyword) return true;
                return [
                    item.displayName,
                    item.description,
                    item.model,
                    item.provider,
                    item.providerName,
                ].some((field) => field?.toLowerCase().includes(keyword));
            })
            .sort((left, right) => {
                const sortDiff = (right.sortOrder ?? 0) - (left.sortOrder ?? 0);
                if (sortDiff !== 0) return sortDiff;
                return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
            });
        const total = items.length;
        const start = (page - 1) * pageSize;
        return {
            items: items.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async listEnabledForWeb() {
        const configs = await this.modelConfigRepository.find({
            where: { enabled: true, visibleToUser: true } as FindOptionsWhere<ImageModelConfig>,
        });
        const models = await this.publicAiModelService.listActiveImageModels(200);
        const modelsById = new Map(models.map((model) => [model.id, model]));
        return configs
            .map((config) => {
                const model = modelsById.get(config.mainModelId);
                return model ? this.toWebOption(this.toResolvedConfig(config, model)) : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    async getConfigCompleteness() {
        const models = await this.publicAiModelService.listActiveImageModels(200);
        const configs = await this.modelConfigRepository.find();
        const configuredModelIds = new Set(configs.map((config) => config.mainModelId));
        return {
            expected: models.length,
            configured: models.filter((model) => configuredModelIds.has(model.id)).length,
            missingModels: models.filter((model) => !configuredModelIds.has(model.id)).map((model) => model.model),
            complete: models.every((model) => configuredModelIds.has(model.id)),
        };
    }

    async findEnabledById(id: string, includeHidden = false): Promise<ResolvedImageModelConfig> {
        const config = await this.findByIdOrFail(id);
        if (!config.enabled || (!includeHidden && !config.visibleToUser)) {
            throw HttpErrorFactory.badRequest(`图像模型配置已在管理后台禁用: ${id}`);
        }
        const model = await this.getImageModelOrFail(config.mainModelId);
        return this.toResolvedConfig(config, model);
    }

    async findEnabledByIdForAdmin(id: string): Promise<ResolvedImageModelConfig> {
        return this.findEnabledById(id, true);
    }

    async findByIdOrFail(id: string) {
        await this.ensureRuntimeSchema();
        const config = await this.modelConfigRepository.findOne({
            where: { id } as FindOptionsWhere<ImageModelConfig>,
        });
        if (!config) {
            throw HttpErrorFactory.notFound("图像模型配置不存在");
        }
        return config;
    }

    async createConfig(dto: CreateModelConfigDto) {
        await this.ensureRuntimeSchema();
        const mainModelId = dto.mainModelId?.trim();
        if (!mainModelId) {
            throw HttpErrorFactory.badRequest("请选择主站图片模型");
        }
        const model = await this.getImageModelOrFail(mainModelId);
        const existing = await this.modelConfigRepository.findOne({
            where: { mainModelId } as FindOptionsWhere<ImageModelConfig>,
        });
        const config = existing ?? this.modelConfigRepository.create({ mainModelId });
        Object.assign(config, await this.normalizeOperationalConfig(dto, config));
        const saved = await this.modelConfigRepository.save(config);
        return this.toOperationalView(saved, model);
    }

    async updateConfig(id: string, dto: UpdateModelConfigDto) {
        const config = await this.findByIdOrFail(id);
        const model = await this.getImageModelOrFail(config.mainModelId);
        Object.assign(config, await this.normalizeOperationalConfig(dto, config));
        const saved = await this.modelConfigRepository.save(config);
        return this.toOperationalView(saved, model);
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
            }));
    }

    async deleteConfig(id: string) {
        await this.findByIdOrFail(id);
        await this.assertConfigUnused(id);
        await this.modelConfigRepository.delete(id);
        return { success: true, message: "删除成功" };
    }

    toWebOption(config: ResolvedImageModelConfig | ImageModelConfig) {
        const resolved = "mainModelId" in config && "providerName" in config
            ? config as ResolvedImageModelConfig
            : undefined;
        if (!resolved) {
            throw HttpErrorFactory.badRequest("图像模型配置缺少主站模型信息");
        }
        return {
            id: resolved.id,
            name: resolved.displayName,
            model: resolved.model,
            modelType: "image",
            description: resolved.description ?? "",
            mediaTypes: ["image"],
            capabilities: this.toRuntimeWebCapabilities(resolved.capabilities),
            defaultParams: this.toPublicDefaultParams(resolved.defaultParams),
            allowedParams: this.toPublicAllowedParams(resolved.allowedParams),
        };
    }

    private toRuntimeWebCapabilities(capabilities?: ImageModelCapabilities): ImageModelCapabilities {
        return {
            textToImage: capabilities?.textToImage !== false,
            imageToImage: false,
            mask: false,
            multiReference: false,
            seed: false,
            negativePrompt: false,
            outputFormat: capabilities?.outputFormat === true,
            background: false,
            moderation: false,
            inputFidelity: false,
        };
    }

    private toPublicDefaultParams(params?: ImageModelDefaultParams): ImageModelDefaultParams {
        return {
            size: params?.size,
            quality: params?.quality,
            style: params?.style,
            n: params?.n,
            responseFormat: params?.responseFormat,
            outputFormat: params?.outputFormat,
        };
    }

    private toPublicAllowedParams(params?: ImageModelAllowedParams): ImageModelAllowedParams {
        return {
            sizes: Array.isArray(params?.sizes) ? params.sizes : undefined,
            qualities: Array.isArray(params?.qualities) ? params.qualities : undefined,
            styles: Array.isArray(params?.styles) ? params.styles : undefined,
            outputFormats: Array.isArray(params?.outputFormats) ? params.outputFormats : undefined,
            maxImages: typeof params?.maxImages === "number" ? params.maxImages : undefined,
        };
    }

    private async ensureRuntimeSchema(): Promise<void> {
        if (!this.modelConfigRepository.manager?.query) return;
        this.schemaReadyPromise ??= (async () => {
            await this.modelConfigRepository.manager.query(`
                ALTER TABLE "echoflow_image"."image_model_config"
                ADD COLUMN IF NOT EXISTS "main_model_id" uuid,
                ADD COLUMN IF NOT EXISTS "display_name_override" varchar(120),
                ADD COLUMN IF NOT EXISTS "description_override" text,
                ADD COLUMN IF NOT EXISTS "prompt_enhancer_model_id" uuid,
                ADD COLUMN IF NOT EXISTS "visible_to_user" boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS "capabilities" jsonb NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "default_params" jsonb NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "allowed_params" jsonb NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "sort_order" int NOT NULL DEFAULT 0
            `);
            await this.modelConfigRepository.manager.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "uq_image_model_config_main_model"
                ON "echoflow_image"."image_model_config" ("main_model_id")
                WHERE "main_model_id" IS NOT NULL
            `);
        })();
        await this.schemaReadyPromise;
    }

    private async normalizeOperationalConfig(
        dto: CreateModelConfigDto | UpdateModelConfigDto,
        existing?: ImageModelConfig,
    ) {
        const promptEnhancerModelId = dto.promptEnhancerModelId === null
            ? null
            : dto.promptEnhancerModelId?.trim() || existing?.promptEnhancerModelId || null;
        if (promptEnhancerModelId) {
            await this.assertPromptEnhancerModelUsable(promptEnhancerModelId);
        }
        return {
            mainModelId: existing?.mainModelId ?? dto.mainModelId!,
            promptEnhancerModelId,
            displayNameOverride: dto.displayNameOverride ?? dto.displayName ?? existing?.displayNameOverride ?? null,
            descriptionOverride: dto.descriptionOverride ?? dto.description ?? existing?.descriptionOverride ?? null,
            enabled: dto.enabled ?? existing?.enabled ?? true,
            visibleToUser: dto.visibleToUser ?? existing?.visibleToUser ?? true,
            capabilities: this.normalizeCapabilities({
                ...(existing?.capabilities ?? DEFAULT_CAPABILITIES),
                ...(dto.capabilities ?? {}),
            }),
            defaultParams: this.normalizeDefaultParams({
                ...(existing?.defaultParams ?? DEFAULT_PARAMS),
                ...(dto.defaultParams ?? {}),
            }),
            allowedParams: this.normalizeAllowedParams({
                ...(existing?.allowedParams ?? DEFAULT_ALLOWED_PARAMS),
                ...(dto.allowedParams ?? {}),
            }),
            sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
        };
    }

    private normalizeCapabilities(capabilities?: ImageModelCapabilities): ImageModelCapabilities {
        return {
            textToImage: capabilities?.textToImage !== false,
            imageToImage: capabilities?.imageToImage === true,
            mask: capabilities?.mask === true,
            multiReference: capabilities?.multiReference === true,
            seed: capabilities?.seed === true,
            negativePrompt: capabilities?.negativePrompt === true,
            outputFormat: capabilities?.outputFormat !== false,
            background: capabilities?.background === true,
            moderation: capabilities?.moderation === true,
            inputFidelity: capabilities?.inputFidelity === true,
        };
    }

    private normalizeDefaultParams(params?: ImageModelDefaultParams): ImageModelDefaultParams {
        return {
            size: params?.size ?? DEFAULT_PARAMS.size,
            quality: params?.quality ?? DEFAULT_PARAMS.quality,
            style: params?.style,
            n: params?.n ?? DEFAULT_PARAMS.n,
            responseFormat: params?.responseFormat ?? DEFAULT_PARAMS.responseFormat,
            outputFormat: params?.outputFormat ?? DEFAULT_PARAMS.outputFormat,
        };
    }

    private normalizeAllowedParams(params?: ImageModelAllowedParams): ImageModelAllowedParams {
        return {
            sizes: Array.isArray(params?.sizes) ? params.sizes : DEFAULT_ALLOWED_PARAMS.sizes,
            qualities: Array.isArray(params?.qualities) ? params.qualities : DEFAULT_ALLOWED_PARAMS.qualities,
            styles: Array.isArray(params?.styles) ? params.styles : DEFAULT_ALLOWED_PARAMS.styles,
            outputFormats: Array.isArray(params?.outputFormats) ? params.outputFormats : DEFAULT_ALLOWED_PARAMS.outputFormats,
            maxImages: typeof params?.maxImages === "number" ? params.maxImages : DEFAULT_ALLOWED_PARAMS.maxImages,
        };
    }

    private async getConfigsByMainModelId() {
        await this.ensureRuntimeSchema();
        const configs = await this.modelConfigRepository.find();
        return new Map(configs.map((config) => [config.mainModelId, config]));
    }

    private async getImageModelOrFail(modelId: string) {
        const model = await this.publicAiModelService.getModelInfo(modelId);
        if (model.modelType !== "text-to-image" || model.isActive === false || model.provider?.isActive === false) {
            throw HttpErrorFactory.badRequest("主站图片模型不可用");
        }
        return model;
    }

    private toResolvedConfig(config: ImageModelConfig, model: Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>): ResolvedImageModelConfig {
        return {
            id: config.id,
            mainModelId: config.mainModelId,
            promptEnhancerModelId: config.promptEnhancerModelId ?? undefined,
            provider: model.provider.provider,
            providerName: model.provider.name,
            model: model.model,
            displayName: config.displayNameOverride || model.name,
            description: config.descriptionOverride ?? model.description,
            enabled: config.enabled,
            visibleToUser: config.visibleToUser,
            capabilities: this.normalizeCapabilities(config.capabilities),
            defaultParams: this.normalizeDefaultParams(config.defaultParams),
            allowedParams: this.normalizeAllowedParams(config.allowedParams),
            sortOrder: config.sortOrder ?? model.sortOrder ?? 0,
        };
    }

    private toOperationalView(config: ImageModelConfig | undefined, model: Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>) {
        const resolved = config
            ? this.toResolvedConfig(config, model)
            : {
                id: "",
                mainModelId: model.id,
                promptEnhancerModelId: null,
                provider: model.provider.provider,
                providerName: model.provider.name,
                model: model.model,
                displayName: model.name,
                description: model.description,
                enabled: false,
                visibleToUser: true,
                capabilities: this.normalizeCapabilities(DEFAULT_CAPABILITIES),
                defaultParams: this.normalizeDefaultParams(DEFAULT_PARAMS),
                allowedParams: this.normalizeAllowedParams(DEFAULT_ALLOWED_PARAMS),
                sortOrder: model.sortOrder ?? 0,
            };
        return {
            ...resolved,
            displayNameOverride: config?.displayNameOverride,
            descriptionOverride: config?.descriptionOverride,
            configured: Boolean(config),
            createdAt: config?.createdAt,
            updatedAt: config?.updatedAt,
        };
    }

    async assertPromptEnhancerModelUsable(modelId: string) {
        const model = await this.getPromptEnhancerModel(modelId);
        if (!model || model.modelType !== "llm" || !model.provider?.isActive) {
            throw HttpErrorFactory.badRequest("提示词润色模型不可用，请选择主站已启用的 LLM 模型");
        }
    }

    private async getPromptEnhancerModel(modelId: string) {
        try {
            return await this.publicAiModelService.getModelInfo(modelId);
        } catch {
            return null;
        }
    }

    private async assertConfigUnused(id: string) {
        const [billing, policy, generation] = await Promise.all([
            this.billingRuleRepository.exists({ where: { modelConfigId: id } as FindOptionsWhere<ImageBillingRule> }),
            this.policyRepository.exists({ where: { modelConfigId: id } as FindOptionsWhere<ImagePolicyConfig> }),
            this.generationRepository.exists({ where: { modelId: id } as FindOptionsWhere<ImageGeneration> }),
        ]);
        if (billing || policy || generation) {
            throw HttpErrorFactory.badRequest("模型配置已被计费、风控或生成记录引用，请停用而不是删除");
        }
    }
}
