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
                if (!model) return null;
                const resolved = this.toResolvedConfig(config, model);
                return this.supportsRuntimeGeneration(resolved) ? this.toWebOption(resolved) : null;
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

    async findEnabledById(modelConfigId: string): Promise<ResolvedVideoModelConfig> {
        const config = await this.modelConfigRepository.findOne({ where: { id: modelConfigId } as FindOptionsWhere<VideoModelConfig> });
        if (!config || !config.enabled || !config.visibleToUser) {
            throw HttpErrorFactory.badRequest(`视频模型已在管理后台禁用: ${modelConfigId}`);
        }
        const mainModel = await this.getVideoModelOrFail(config.mainModelId);
        const resolved = this.toResolvedConfig(config, mainModel);
        if (!this.supportsRuntimeGeneration(resolved)) {
            throw HttpErrorFactory.badRequest("当前视频模型能力尚未完成验证");
        }
        return resolved;
    }

    async findByIdOrFail(id: string) {
        const config = await this.modelConfigRepository.findOne({ where: { id } as FindOptionsWhere<VideoModelConfig> });
        if (!config) throw HttpErrorFactory.notFound("视频模型配置不存在");
        return config;
    }

    async createConfig(dto: UpdateVideoModelConfigDto) {
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

    private supportsRuntimeGeneration(config: ResolvedVideoModelConfig): boolean {
        const abilityTypes = config.capabilities.abilityTypes ?? [];
        const mediaTypes = config.capabilities.mediaTypes ?? [];
        const supportsTextOnly = abilityTypes.length === 1 && abilityTypes[0] === "text_to_video" && mediaTypes.length === 0;
        const supportsSingleFirstFrame =
            abilityTypes.length === 1 &&
            abilityTypes[0] === "first_frame_i2v" &&
            mediaTypes.length === 1 &&
            mediaTypes[0] === "first_frame";
        return config.capabilities.apiContractVerified === true && (supportsTextOnly || supportsSingleFirstFrame);
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
