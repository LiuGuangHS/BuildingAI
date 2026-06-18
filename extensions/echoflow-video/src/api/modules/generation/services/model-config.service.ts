import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import {
    VideoModelConfig,
    type VideoModelCapabilities,
    type VideoModelDefaultParams,
    type VideoModelEndpoint,
} from "../../../db/entities/video-model-config.entity";
import {
    CreateVideoModelConfigDto,
    QueryVideoModelConfigDto,
    UpdateVideoModelConfigDto,
    VideoModelEndpointDto,
} from "../dto";
import {
    BUILT_IN_VIDEO_MODEL_CONFIGS,
    getBuiltInVideoModel,
    type BuiltInVideoModelConfig,
} from "./video-model-catalog";
import { defaultHappyHorseClientOptions } from "./happyhorse-client";

export interface ResolvedVideoModelConfig {
    id?: string;
    provider: string;
    model: string;
    externalModelId: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: VideoModelCapabilities;
    defaultParams: VideoModelDefaultParams;
    endpoints: VideoModelEndpoint[];
    submitPath: string;
    pollPath: string;
    sortOrder: number;
}

@Injectable()
export class ModelConfigService extends BaseService<VideoModelConfig> {
    private schemaReadyPromise?: Promise<void>;

    constructor(
        @InjectRepository(VideoModelConfig)
        private readonly modelConfigRepository: Repository<VideoModelConfig>,
        private readonly secretService: SecretService,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryVideoModelConfigDto) {
        const page = Math.max(Number(query.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
        const keyword = query.keyword?.trim().toLowerCase();
        const items = (await this.ensureDefaultModelConfigs())
            .filter((config) => query.enabled === undefined || config.enabled === query.enabled)
            .filter((config) => {
                if (!keyword) return true;
                return [
                    config.displayName,
                    config.description,
                    config.model,
                    config.provider,
                ].some((field) => field?.toLowerCase().includes(keyword));
            })
            .sort((left, right) => {
                const sortDiff = (right.sortOrder ?? 0) - (left.sortOrder ?? 0);
                if (sortDiff !== 0) return sortDiff;
                return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
            })
            .map((config) => this.toOperationalView(config));
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
        const configs = await this.ensureDefaultModelConfigs();
        return configs
            .filter((config) => config.enabled && config.visibleToUser)
            .filter((config) => this.hasUsableEndpoint(this.toResolvedConfig(config)))
            .sort((left, right) => (right.sortOrder ?? 0) - (left.sortOrder ?? 0))
            .map((config) => this.toWebOption(this.toResolvedConfig(config)));
    }

    async getConfigCompleteness() {
        await this.ensureDefaultModelConfigs();
        const configs = await this.modelConfigRepository.find();
        const configuredModels = new Set(configs.map((config) => config.model));
        const supportedConfigs = configs.filter((config) => this.isSupportedModelConfig(config.model));
        const enabledVisible = supportedConfigs.filter((config) => config.enabled && config.visibleToUser);
        const missingModels = BUILT_IN_VIDEO_MODEL_CONFIGS
            .filter((config) => !configuredModels.has(config.model))
            .map((config) => config.model);
        const unverifiedModels = supportedConfigs
            .filter((config) => getBuiltInVideoModel(config.model)?.capabilities?.apiContractVerified !== true)
            .map((config) => config.model);

        return {
            expected: BUILT_IN_VIDEO_MODEL_CONFIGS.length,
            configured: supportedConfigs.length,
            enabledVisible: enabledVisible.length,
            missingModels,
            unverifiedModels,
            complete: missingModels.length === 0 && unverifiedModels.length === 0,
        };
    }

    async findEnabledByModel(model: string): Promise<ResolvedVideoModelConfig> {
        await this.ensureDefaultModelConfigs();
        const config = await this.modelConfigRepository.findOne({
            where: { model } as FindOptionsWhere<VideoModelConfig>,
        });
        if (!config) {
            throw HttpErrorFactory.badRequest(`不支持的视频模型: ${model}`);
        }
        if (!config.enabled || !config.visibleToUser) {
            throw HttpErrorFactory.badRequest(`视频模型已在管理后台禁用: ${model}`);
        }
        this.assertSupportedModelConfig(config.model);
        const resolved = this.toResolvedConfig(config);
        this.pickRuntimeEndpoint(resolved);
        return resolved;
    }

    async findByIdOrFail(id: string) {
        await this.ensureRuntimeSchema();
        const config = await this.modelConfigRepository.findOne({
            where: { id } as FindOptionsWhere<VideoModelConfig>,
        });
        if (!config) {
            throw HttpErrorFactory.notFound("视频模型配置不存在");
        }
        return config;
    }

    async createConfig(dto: CreateVideoModelConfigDto) {
        void dto;
        throw HttpErrorFactory.badRequest("视频模型由插件内置目录提供，请调整启用、可见性、排序、默认参数和接入点");
    }

    async updateConfig(id: string, dto: UpdateVideoModelConfigDto) {
        const config = await this.findByIdOrFail(id);
        this.assertSupportedModelConfig(config.model);
        Object.assign(config, this.normalizeOperationalConfig(dto, config));
        const saved = await this.modelConfigRepository.save(config);
        return this.toOperationalView(saved);
    }

    async testEndpoint(id: string, endpointDto: VideoModelEndpointDto) {
        const config = await this.findByIdOrFail(id);
        this.assertSupportedModelConfig(config.model);
        const resolved = this.toResolvedConfig(config);
        const [endpoint] = this.normalizeEndpointConfigs([endpointDto], config.endpoints ?? [], true);
        const credential = await this.resolveEndpointCredential(endpoint);
        const { VideoGatewayClient } = await import("./video-gateway-client");
        await new VideoGatewayClient(resolved, endpoint, credential.apiKey, credential.baseUrl).testConnection();
        return { success: true, message: "接入点配置可用" };
    }

    async deleteConfig(id: string) {
        void id;
        throw HttpErrorFactory.badRequest("内置视频模型不能删除，请使用停用或隐藏");
    }

    pickRuntimeEndpoint(config: ResolvedVideoModelConfig): VideoModelEndpoint {
        const endpoint = (config.endpoints ?? [])
            .filter((item) => item.enabled && item.secretId)
            .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
        if (!endpoint) {
            throw HttpErrorFactory.badRequest(`模型 ${config.displayName} 未绑定可用主站密钥`);
        }
        return endpoint;
    }

    async resolveEndpointCredential(endpoint: VideoModelEndpoint) {
        if (!endpoint.secretId) {
            throw HttpErrorFactory.badRequest("请先为接入点选择主站密钥");
        }
        const secretConfig = await this.secretService.getConfigKeyValuePairs(endpoint.secretId);
        const values = this.flattenSecretConfig(secretConfig);
        const apiKey = this.pickFirst(values, ["apiKey", "api_key", "API_KEY", "key", "token"]);
        const baseUrl = endpoint.baseUrlOverride ||
            this.pickFirst(values, ["baseURL", "baseUrl", "base_url", "BASE_URL", "endpoint"]) ||
            defaultHappyHorseClientOptions.baseUrl;
        if (!apiKey) {
            throw HttpErrorFactory.badRequest("主站密钥中未找到 apiKey/api_key 字段");
        }
        return {
            apiKey,
            baseUrl: this.normalizeBaseUrl(baseUrl),
        };
    }

    async resolveRuntimeEndpoint(config: ResolvedVideoModelConfig) {
        const endpoint = this.pickRuntimeEndpoint(config);
        const credential = await this.resolveEndpointCredential(endpoint);
        return { endpoint, ...credential };
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

    private async ensureDefaultModelConfigs(): Promise<VideoModelConfig[]> {
        await this.ensureRuntimeSchema();
        const existing = await this.modelConfigRepository.find({
            where: {} as FindOptionsWhere<VideoModelConfig>,
        });
        const supportedExisting = existing.filter((config) => this.isSupportedModelConfig(config.model));
        const existingModels = new Set(supportedExisting.map((config) => config.model));
        const missing = BUILT_IN_VIDEO_MODEL_CONFIGS.filter((config) => !existingModels.has(config.model));
        if (missing.length === 0) return supportedExisting;

        const created = await this.modelConfigRepository.save(
            missing.map((config) => this.modelConfigRepository.create({
                provider: config.provider,
                model: config.model,
                displayName: config.displayName,
                description: config.description,
                enabled: config.enabled,
                visibleToUser: config.visibleToUser,
                capabilities: config.capabilities,
                defaultParams: config.defaultParams,
                endpoints: this.normalizeEndpointConfigs(config.endpoints, [], false),
                sortOrder: config.sortOrder,
            })),
        );
        const createdItems = Array.isArray(created) ? created : [created];
        return [...supportedExisting, ...createdItems];
    }

    private async ensureRuntimeSchema(): Promise<void> {
        if (!this.modelConfigRepository.manager?.query) {
            return;
        }
        this.schemaReadyPromise ??= this.modelConfigRepository.manager.query(`
            ALTER TABLE "echoflow_video"."video_model_config"
            ADD COLUMN IF NOT EXISTS "endpoints" jsonb NOT NULL DEFAULT '[]'
        `);
        await this.schemaReadyPromise;
    }

    private normalizeOperationalConfig(
        dto: UpdateVideoModelConfigDto,
        existing?: VideoModelConfig,
    ) {
        const defaultConfig = getBuiltInVideoModel(existing?.model ?? "");
        if (!existing || !defaultConfig) {
            throw HttpErrorFactory.badRequest("内置视频模型配置不存在");
        }

        return {
            provider: defaultConfig.provider,
            model: defaultConfig.model,
            displayName: dto.displayName ?? existing.displayName ?? defaultConfig.displayName,
            description: dto.description ?? existing.description ?? defaultConfig.description,
            enabled: dto.enabled ?? existing.enabled ?? true,
            visibleToUser: dto.visibleToUser ?? existing.visibleToUser ?? true,
            capabilities: defaultConfig.capabilities,
            defaultParams: this.normalizeDefaultParams(dto.defaultParams ?? existing.defaultParams, defaultConfig),
            endpoints: dto.endpoints
                ? this.normalizeEndpointConfigs(dto.endpoints, existing.endpoints ?? [], true)
                : this.normalizeEndpointConfigs(existing.endpoints ?? defaultConfig.endpoints, [], false),
            sortOrder: dto.sortOrder ?? existing.sortOrder ?? defaultConfig.sortOrder,
        };
    }

    private toResolvedConfig(config: VideoModelConfig): ResolvedVideoModelConfig {
        const defaultConfig = getBuiltInVideoModel(config.model);
        if (!defaultConfig) {
            throw HttpErrorFactory.badRequest(`不支持的视频模型: ${config.model}`);
        }

        return {
            id: config.id,
            provider: defaultConfig.provider,
            model: defaultConfig.model,
            externalModelId: defaultConfig.externalModelId,
            displayName: config.displayName || defaultConfig.displayName,
            description: config.description ?? defaultConfig.description,
            enabled: config.enabled,
            visibleToUser: config.visibleToUser,
            capabilities: defaultConfig.capabilities,
            defaultParams: this.normalizeDefaultParams(config.defaultParams, defaultConfig),
            endpoints: this.normalizeEndpointConfigs(config.endpoints?.length ? config.endpoints : defaultConfig.endpoints, [], false),
            submitPath: defaultConfig.submitPath,
            pollPath: defaultConfig.pollPath,
            sortOrder: config.sortOrder ?? defaultConfig.sortOrder,
        };
    }

    private toOperationalView(config: VideoModelConfig): VideoModelConfig {
        const resolved = this.toResolvedConfig(config);
        return {
            ...config,
            ...resolved,
            endpoints: this.maskEndpoints(resolved.endpoints),
        };
    }

    private normalizeDefaultParams(
        value: VideoModelDefaultParams | undefined,
        defaultConfig: BuiltInVideoModelConfig,
    ): VideoModelDefaultParams {
        const params = {
            ...defaultConfig.defaultParams,
            ...(value ?? {}),
        };
        const durationCapability = defaultConfig.capabilities.duration;
        if (params.duration && durationCapability?.allowedValues?.length && !durationCapability.allowedValues.includes(params.duration)) {
            params.duration = defaultConfig.defaultParams.duration;
        }
        if (params.duration && durationCapability?.min && params.duration < durationCapability.min) {
            params.duration = defaultConfig.defaultParams.duration;
        }
        if (params.duration && durationCapability?.max && params.duration > durationCapability.max) {
            params.duration = defaultConfig.defaultParams.duration;
        }
        if (params.resolution && !defaultConfig.capabilities.resolutions?.includes(params.resolution)) {
            params.resolution = defaultConfig.defaultParams.resolution;
        }
        if (params.ratio && defaultConfig.capabilities.ratios?.length && !defaultConfig.capabilities.ratios.includes(params.ratio)) {
            params.ratio = defaultConfig.defaultParams.ratio;
        }
        return params;
    }

    private normalizeEndpointConfigs(
        endpoints: Array<VideoModelEndpoint | VideoModelEndpointDto> | undefined,
        existing: VideoModelEndpoint[],
        encryptPlainKeys: boolean,
    ): VideoModelEndpoint[] {
        const byId = new Map(existing.map((endpoint) => [endpoint.id, endpoint]));
        const normalized = (endpoints ?? []).map((endpoint, index) => {
            const id = endpoint.id?.trim() || `endpoint-${index + 1}`;
            const previous = byId.get(id);
            void encryptPlainKeys;
            return {
                id,
                name: endpoint.name?.trim().slice(0, 80) || `接入点 ${index + 1}`,
                secretId: endpoint.secretId?.trim() || previous?.secretId,
                secretName: endpoint.secretName?.trim() || previous?.secretName,
                baseUrlOverride: endpoint.baseUrlOverride
                    ? this.normalizeBaseUrl(endpoint.baseUrlOverride)
                    : previous?.baseUrlOverride,
                enabled: endpoint.enabled ?? true,
                priority: this.normalizeInteger(endpoint.priority ?? 100 - index, 0, 100000, "接入点优先级"),
                requestTimeoutMs: this.normalizeInteger(endpoint.requestTimeoutMs ?? 120_000, 3000, 300000, "请求超时"),
                testTimeoutMs: this.normalizeInteger(endpoint.testTimeoutMs ?? 15_000, 3000, 60000, "测试超时"),
                maxRetries: this.normalizeInteger(endpoint.maxRetries ?? 2, 0, 5, "重试次数"),
                retryDelayMs: this.normalizeInteger(endpoint.retryDelayMs ?? 1_000, 100, 10000, "重试延迟"),
            };
        });

        if (normalized.length === 0) {
            throw HttpErrorFactory.badRequest("每个视频模型至少需要保留一个接入点");
        }
        return normalized;
    }

    private maskEndpoints(endpoints: VideoModelEndpoint[]): VideoModelEndpoint[] {
        return endpoints.map((endpoint) => ({ ...endpoint }));
    }

    private hasUsableEndpoint(config: ResolvedVideoModelConfig): boolean {
        return (config.endpoints ?? []).some((endpoint) => endpoint.enabled && endpoint.secretId);
    }

    private normalizeBaseUrl(value?: string): string {
        const trimmed = value?.trim().replace(/\/+$/, "") ?? "";
        if (!trimmed) {
            throw HttpErrorFactory.badRequest("Base URL 不能为空");
        }

        let url: URL;
        try {
            url = new URL(trimmed);
        } catch {
            throw HttpErrorFactory.badRequest("Base URL 格式不正确");
        }
        if (!["http:", "https:"].includes(url.protocol)) {
            throw HttpErrorFactory.badRequest("Base URL 仅支持 http/https");
        }
        if (url.username || url.password) {
            throw HttpErrorFactory.badRequest("Base URL 不允许包含用户名或密码");
        }
        if (this.isPrivateOrLocalHost(url.hostname)) {
            throw HttpErrorFactory.badRequest("Base URL 不允许指向本机或内网地址");
        }
        return trimmed;
    }

    private isPrivateOrLocalHost(hostname: string): boolean {
        const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
        return (
            host === "localhost" ||
            host === "0.0.0.0" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host.endsWith(".local") ||
            host.startsWith("10.") ||
            host.startsWith("127.") ||
            host.startsWith("169.254.") ||
            host.startsWith("192.168.") ||
            /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        );
    }

    private normalizeInteger(value: number, min: number, max: number, label: string): number {
        if (!Number.isInteger(value) || value < min || value > max) {
            throw HttpErrorFactory.badRequest(`${label}必须是 ${min} 到 ${max} 之间的整数`);
        }
        return value;
    }

    private flattenSecretConfig(config: Record<string, { value: string; required: boolean }>): Record<string, string> {
        return Object.fromEntries(Object.entries(config).map(([key, item]) => [key, item.value ?? ""]));
    }

    private pickFirst(values: Record<string, string>, keys: string[]): string {
        for (const key of keys) {
            const value = values[key]?.trim();
            if (value) return value;
        }
        return "";
    }

    private assertSupportedModelConfig(model: string) {
        if (!this.isSupportedModelConfig(model)) {
            throw HttpErrorFactory.badRequest(`视频模型 ${model} 不在插件内置目录中`);
        }
    }

    private isSupportedModelConfig(model: string) {
        return Boolean(getBuiltInVideoModel(model));
    }
}

export const defaultVideoModelConfigs = BUILT_IN_VIDEO_MODEL_CONFIGS;
