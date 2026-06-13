import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { buildWhere } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { HappyHorseModel } from "../../../db/entities/video-generation.entity";
import {
    VideoModelConfig,
    type VideoModelCapabilities,
    type VideoModelDefaultParams,
} from "../../../db/entities/video-model-config.entity";
import {
    CreateVideoModelConfigDto,
    QueryVideoModelConfigDto,
    UpdateVideoModelConfigDto,
} from "../dto";

export interface ResolvedVideoModelConfig {
    id?: string;
    provider: string;
    model: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: VideoModelCapabilities;
    defaultParams: VideoModelDefaultParams;
    sortOrder: number;
}

const DEFAULT_MODEL_CONFIGS: ResolvedVideoModelConfig[] = [
    {
        provider: "happyhorse",
        model: HappyHorseModel.I2V,
        displayName: "HappyHorse 图生视频 (i2v)",
        description: "上传一张首帧图片 + 提示词，生成视频",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            abilityTypes: ["first_frame_i2v", "native_audio"],
            mediaTypes: ["first_frame"],
            duration: { min: 3, max: 15 },
            resolutions: ["720P", "1080P"],
            ratios: ["16:9", "9:16", "1:1"],
            fps: 24,
            format: "mp4",
            apiContractVerified: true,
        },
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 30,
    },
    {
        provider: "happyhorse",
        model: HappyHorseModel.R2V,
        displayName: "HappyHorse 参考图生视频 (r2v)",
        description: "上传 1-4 张参考图 + 提示词，生成视频",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            abilityTypes: ["reference_to_video", "digital_human", "native_audio"],
            mediaTypes: ["reference_image"],
            duration: { min: 3, max: 15 },
            resolutions: ["720P", "1080P"],
            ratios: ["16:9", "9:16", "1:1", "3:4", "4:3"],
            fps: 24,
            format: "mp4",
            apiContractVerified: true,
        },
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 20,
    },
    {
        provider: "happyhorse",
        model: HappyHorseModel.T2V,
        displayName: "HappyHorse 文生视频 (t2v)",
        description: "纯文本提示词生成视频，无需上传图片",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            abilityTypes: ["text_to_video", "native_audio"],
            mediaTypes: [],
            duration: { min: 3, max: 15 },
            resolutions: ["720P", "1080P"],
            ratios: ["16:9", "9:16", "1:1"],
            fps: 24,
            format: "mp4",
            apiContractVerified: true,
        },
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 10,
    },
    {
        provider: "happyhorse",
        model: HappyHorseModel.VIDEO_EDIT,
        displayName: "HappyHorse 视频编辑 (video-edit)",
        description: "上传视频 + 可选参考图 + 提示词，编辑/变换视频",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            abilityTypes: ["video_editing", "action_transfer", "native_audio"],
            mediaTypes: ["video", "reference_image"],
            duration: { min: 3, max: 15 },
            resolutions: ["720P", "1080P"],
            fps: 24,
            format: "mp4",
            apiContractVerified: true,
        },
        defaultParams: { duration: 5, resolution: "720P", watermark: true },
        sortOrder: 0,
    },
];

@Injectable()
export class ModelConfigService extends BaseService<VideoModelConfig> {
    constructor(
        @InjectRepository(VideoModelConfig)
        private readonly modelConfigRepository: Repository<VideoModelConfig>,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryVideoModelConfigDto) {
        const where = buildWhere<VideoModelConfig>({
            displayName: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            enabled: query.enabled,
        });

        return this.paginate(query, {
            where,
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
    }

    async listEnabledForWeb() {
        const configs = await this.modelConfigRepository.find({
            where: { enabled: true, visibleToUser: true } as FindOptionsWhere<VideoModelConfig>,
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });

        const total = await this.modelConfigRepository.count();
        const source = total === 0 ? DEFAULT_MODEL_CONFIGS : configs;
        return source.map((config) => this.toWebOption(config));
    }

    async getConfigCompleteness() {
        const configs = await this.modelConfigRepository.find();
        const configuredModels = new Set(configs.map((config) => config.model));
        const enabledVisible = configs.filter((config) => config.enabled && config.visibleToUser);
        const missingModels = DEFAULT_MODEL_CONFIGS
            .filter((config) => !configuredModels.has(config.model))
            .map((config) => config.model);
        const unverifiedModels = configs
            .filter((config) => config.capabilities?.apiContractVerified !== true)
            .map((config) => config.model);

        return {
            expected: DEFAULT_MODEL_CONFIGS.length,
            configured: configs.length,
            enabledVisible: configs.length === 0 ? DEFAULT_MODEL_CONFIGS.length : enabledVisible.length,
            missingModels,
            unverifiedModels,
            complete: missingModels.length === 0 && unverifiedModels.length === 0,
        };
    }

    async findEnabledByModel(model: string): Promise<ResolvedVideoModelConfig> {
        const config = await this.modelConfigRepository.findOne({
            where: { model } as FindOptionsWhere<VideoModelConfig>,
        });
        if (config) {
            if (!config.enabled || !config.visibleToUser) {
                throw HttpErrorFactory.badRequest(`视频模型已在管理后台禁用: ${model}`);
            }
            return this.toResolvedConfig(config);
        }

        const total = await this.modelConfigRepository.count();
        if (total === 0) {
            const fallback = DEFAULT_MODEL_CONFIGS.find((item) => item.model === model);
            if (fallback) return fallback;
        }

        throw HttpErrorFactory.badRequest(`不支持的视频模型: ${model}`);
    }

    async findByIdOrFail(id: string) {
        const config = await this.modelConfigRepository.findOne({
            where: { id } as FindOptionsWhere<VideoModelConfig>,
        });
        if (!config) {
            throw HttpErrorFactory.notFound("视频模型配置不存在");
        }
        return config;
    }

    async createConfig(dto: CreateVideoModelConfigDto) {
        const existing = await this.modelConfigRepository.findOne({
            where: { model: dto.model } as FindOptionsWhere<VideoModelConfig>,
        });
        if (existing) {
            throw HttpErrorFactory.badRequest("该视频模型已经存在配置");
        }
        return this.modelConfigRepository.save(
            this.modelConfigRepository.create(this.normalizeConfig(dto)),
        );
    }

    async updateConfig(id: string, dto: UpdateVideoModelConfigDto) {
        const config = await this.findByIdOrFail(id);
        if (dto.model && dto.model !== config.model) {
            const existing = await this.modelConfigRepository.findOne({
                where: { model: dto.model } as FindOptionsWhere<VideoModelConfig>,
            });
            if (existing && existing.id !== id) {
                throw HttpErrorFactory.badRequest("该视频模型已经存在配置");
            }
        }
        Object.assign(config, this.normalizeConfig(dto, config));
        return this.modelConfigRepository.save(config);
    }

    async deleteConfig(id: string) {
        await this.findByIdOrFail(id);
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    toWebOption(config: ResolvedVideoModelConfig | VideoModelConfig) {
        return {
            id: config.model,
            modelConfigId: "id" in config ? config.id : undefined,
            name: config.displayName,
            model: config.model,
            provider: config.provider,
            modelType: config.capabilities?.abilityTypes?.[0] ?? "video",
            description: config.description ?? "",
            mediaTypes: config.capabilities?.mediaTypes ?? [],
            capabilities: config.capabilities ?? {},
            defaultParams: config.defaultParams ?? {},
        };
    }

    private normalizeConfig(
        dto: CreateVideoModelConfigDto | UpdateVideoModelConfigDto,
        existing?: VideoModelConfig,
    ) {
        return {
            ...dto,
            provider: dto.provider ?? existing?.provider ?? "happyhorse",
            enabled: dto.enabled ?? existing?.enabled ?? true,
            visibleToUser: dto.visibleToUser ?? existing?.visibleToUser ?? true,
            capabilities: {
                ...(existing?.capabilities ?? {}),
                ...(dto.capabilities ?? {}),
            },
            defaultParams: {
                ...(existing?.defaultParams ?? {}),
                ...(dto.defaultParams ?? {}),
            },
            sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
        };
    }

    private toResolvedConfig(config: VideoModelConfig): ResolvedVideoModelConfig {
        return {
            id: config.id,
            provider: config.provider,
            model: config.model,
            displayName: config.displayName,
            description: config.description,
            enabled: config.enabled,
            visibleToUser: config.visibleToUser,
            capabilities: config.capabilities ?? {},
            defaultParams: config.defaultParams ?? {},
            sortOrder: config.sortOrder,
        };
    }
}

export const defaultVideoModelConfigs = DEFAULT_MODEL_CONFIGS;
