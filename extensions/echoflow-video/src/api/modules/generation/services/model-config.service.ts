import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { Injectable } from "@nestjs/common";

import { VideoGeneration, VideoGenerationStatus } from "../../../db/entities/video-generation.entity";
import {
    VideoModelConfig,
    type VideoModelCapabilities,
    type VideoModelDefaultParams,
} from "../../../db/entities/video-model-config.entity";
import { QueryVideoModelConfigDto, UpdateVideoModelConfigDto } from "../dto";

export interface ResolvedVideoModelConfig {
    id: string;
    mainModelId: string;
    provider: string;
    providerName: string;
    model: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: VideoModelCapabilities;
    defaultParams: VideoModelDefaultParams;
    sortOrder: number;
}

const DEFAULT_CAPABILITIES: VideoModelCapabilities = {
    abilityTypes: ["text_to_video"],
    mediaTypes: [],
    duration: { allowedValues: [5, 10] },
    resolutions: ["1280x720", "720x1280"],
    ratios: ["16:9", "9:16", "1:1"],
    fps: 24,
    format: "mp4",
};

const DEFAULT_PARAMS: VideoModelDefaultParams = {
    duration: 5,
    resolution: "1280x720",
    ratio: "16:9",
    watermark: true,
};

@Injectable()
export class ModelConfigService extends BaseService<VideoModelConfig> {
    private schemaReadyPromise?: Promise<void>;

    constructor(
        @InjectRepository(VideoModelConfig)
        private readonly modelConfigRepository: Repository<VideoModelConfig>,
        @InjectRepository(VideoGeneration)
        private readonly generationRepository: Repository<VideoGeneration>,
        private readonly publicAiModelService: PublicAiModelService,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryVideoModelConfigDto) {
        const page = Math.max(Number(query.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
        const keyword = query.keyword?.trim().toLowerCase();
        const configsByModelId = await this.getConfigsByMainModelId();
        const items = (await this.publicAiModelService.listActiveVideoModels(200))
            .map((model) => this.toOperationalView(configsByModelId.get(model.id), model))
            .filter((item) => query.enabled === undefined || item.enabled === query.enabled)
            .filter((item) => !keyword || [item.displayName, item.description, item.model, item.provider, item.providerName]
                .some((field) => field?.toLowerCase().includes(keyword)))
            .sort((left, right) => (right.sortOrder ?? 0) - (left.sortOrder ?? 0));
        const total = items.length;
        const start = (page - 1) * pageSize;
        return { items: items.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    async listEnabledForWeb() {
        const configs = await this.modelConfigRepository.find({ where: { enabled: true, visibleToUser: true } as FindOptionsWhere<VideoModelConfig> });
        const models = await this.publicAiModelService.listActiveVideoModels(200);
        const modelsById = new Map(models.map((model) => [model.id, model]));
        return configs
            .map((config) => {
                const model = modelsById.get(config.mainModelId);
                return model ? this.toWebOption(this.toResolvedConfig(config, model)) : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    async getConfigCompleteness() {
        const models = await this.publicAiModelService.listActiveVideoModels(200);
        const configs = await this.modelConfigRepository.find();
        const configuredModelIds = new Set(configs.map((config) => config.mainModelId));
        return {
            expected: models.length,
            configured: models.filter((model) => configuredModelIds.has(model.id)).length,
            enabledVisible: configs.filter((config) => config.enabled && config.visibleToUser).length,
            missingModels: models.filter((model) => !configuredModelIds.has(model.id)).map((model) => model.model),
            unverifiedModels: [],
            complete: models.every((model) => configuredModelIds.has(model.id)),
        };
    }

    async findEnabledByModel(model: string): Promise<ResolvedVideoModelConfig> {
        await this.ensureRuntimeSchema();
        const config = await this.modelConfigRepository.findOne({ where: { id: model } as FindOptionsWhere<VideoModelConfig> });
        if (!config || !config.enabled || !config.visibleToUser) {
            throw HttpErrorFactory.badRequest(`视频模型已在管理后台禁用: ${model}`);
        }
        const mainModel = await this.getVideoModelOrFail(config.mainModelId);
        return this.toResolvedConfig(config, mainModel);
    }

    async findByIdOrFail(id: string) {
        await this.ensureRuntimeSchema();
        const config = await this.modelConfigRepository.findOne({ where: { id } as FindOptionsWhere<VideoModelConfig> });
        if (!config) throw HttpErrorFactory.notFound("视频模型配置不存在");
        return config;
    }

    async createConfig(dto: UpdateVideoModelConfigDto) {
        await this.ensureRuntimeSchema();
        const mainModelId = dto.mainModelId?.trim();
        if (!mainModelId) throw HttpErrorFactory.badRequest("请选择主站视频模型");
        const model = await this.getVideoModelOrFail(mainModelId);
        const existing = await this.modelConfigRepository.findOne({ where: { mainModelId } as FindOptionsWhere<VideoModelConfig> });
        const config = existing ?? this.modelConfigRepository.create({ mainModelId });
        Object.assign(config, this.normalizeOperationalConfig(dto, config));
        const saved = await this.modelConfigRepository.save(config);
        return this.toOperationalView(saved, model);
    }

    async updateConfig(id: string, dto: UpdateVideoModelConfigDto) {
        const config = await this.findByIdOrFail(id);
        const normalized = this.normalizeOperationalConfig(dto, config);
        if (config.enabled && normalized.enabled === false) await this.assertNoActiveGenerations(config.id);
        Object.assign(config, normalized);
        const saved = await this.modelConfigRepository.save(config);
        const model = await this.getVideoModelOrFail(saved.mainModelId);
        return this.toOperationalView(saved, model);
    }

    toWebOption(config: ResolvedVideoModelConfig) {
        return {
            id: config.id,
            modelConfigId: config.id,
            name: config.displayName,
            model: config.model,
            modelType: config.capabilities?.abilityTypes?.[0] ?? "text_to_video",
            description: config.description ?? "",
            mediaTypes: config.capabilities?.mediaTypes ?? [],
            capabilities: config.capabilities ?? {},
            defaultParams: config.defaultParams ?? {},
        };
    }

    private async ensureRuntimeSchema(): Promise<void> {
        if (!this.modelConfigRepository.manager?.query) return;
        this.schemaReadyPromise ??= (async () => {
            await this.modelConfigRepository.manager.query(`
                ALTER TABLE "echoflow_video"."video_model_config"
                ADD COLUMN IF NOT EXISTS "main_model_id" uuid,
                ADD COLUMN IF NOT EXISTS "display_name_override" varchar(120),
                ADD COLUMN IF NOT EXISTS "description_override" text,
                ADD COLUMN IF NOT EXISTS "visible_to_user" boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS "capabilities" jsonb NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "default_params" jsonb NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "sort_order" int NOT NULL DEFAULT 0
            `);
            await this.modelConfigRepository.manager.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_model_config_main_model"
                ON "echoflow_video"."video_model_config" ("main_model_id")
                WHERE "main_model_id" IS NOT NULL
            `);
        })();
        await this.schemaReadyPromise;
    }

    private normalizeOperationalConfig(dto: UpdateVideoModelConfigDto, existing?: VideoModelConfig) {
        return {
            mainModelId: existing?.mainModelId ?? dto.mainModelId!,
            displayNameOverride: dto.displayNameOverride ?? dto.displayName ?? existing?.displayNameOverride ?? null,
            descriptionOverride: dto.descriptionOverride ?? dto.description ?? existing?.descriptionOverride ?? null,
            enabled: dto.enabled ?? existing?.enabled ?? true,
            visibleToUser: dto.visibleToUser ?? existing?.visibleToUser ?? true,
            capabilities: { ...DEFAULT_CAPABILITIES, ...(existing?.capabilities ?? {}), ...(dto.capabilities ?? {}) },
            defaultParams: { ...DEFAULT_PARAMS, ...(existing?.defaultParams ?? {}), ...(dto.defaultParams ?? {}) },
            sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
        };
    }

    private async getConfigsByMainModelId() {
        await this.ensureRuntimeSchema();
        const configs = await this.modelConfigRepository.find();
        return new Map(configs.map((config) => [config.mainModelId, config]));
    }

    private async getVideoModelOrFail(modelId: string) {
        const model = await this.publicAiModelService.getModelInfo(modelId);
        if (model.modelType !== "text-to-video" || model.isActive === false || model.provider?.isActive === false) {
            throw HttpErrorFactory.badRequest("主站视频模型不可用");
        }
        return model;
    }

    private toResolvedConfig(config: VideoModelConfig, model: Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>): ResolvedVideoModelConfig {
        return {
            id: config.id,
            mainModelId: config.mainModelId,
            provider: model.provider.provider,
            providerName: model.provider.name,
            model: model.model,
            displayName: config.displayNameOverride || model.name,
            description: config.descriptionOverride ?? model.description,
            enabled: config.enabled,
            visibleToUser: config.visibleToUser,
            capabilities: { ...DEFAULT_CAPABILITIES, ...(config.capabilities ?? {}) },
            defaultParams: { ...DEFAULT_PARAMS, ...(config.defaultParams ?? {}) },
            sortOrder: config.sortOrder ?? model.sortOrder ?? 0,
        };
    }

    private toOperationalView(config: VideoModelConfig | undefined, model: Awaited<ReturnType<PublicAiModelService["getModelInfo"]>>) {
        const resolved = config
            ? this.toResolvedConfig(config, model)
            : {
                id: "",
                mainModelId: model.id,
                provider: model.provider.provider,
                providerName: model.provider.name,
                model: model.model,
                displayName: model.name,
                description: model.description,
                enabled: false,
                visibleToUser: true,
                capabilities: DEFAULT_CAPABILITIES,
                defaultParams: DEFAULT_PARAMS,
                sortOrder: model.sortOrder ?? 0,
            };
        return { ...resolved, configured: Boolean(config), displayNameOverride: config?.displayNameOverride, descriptionOverride: config?.descriptionOverride, createdAt: config?.createdAt, updatedAt: config?.updatedAt };
    }

    private async assertNoActiveGenerations(modelConfigId?: string) {
        if (!modelConfigId) return;
        const activeCount = await this.generationRepository.count({
            where: { modelConfigId, status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]) } as FindOptionsWhere<VideoGeneration>,
        });
        if (activeCount > 0) throw HttpErrorFactory.badRequest("该视频模型仍有视频任务处理中，完成或失败后才能停用或隐藏");
    }
}
