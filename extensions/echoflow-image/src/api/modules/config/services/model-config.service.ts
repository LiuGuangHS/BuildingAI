import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { ImageBillingRule } from "../../../db/entities/image-billing-rule.entity";
import { ImageGeneration } from "../../../db/entities/image-generation.entity";
import {
    ImageModelConfig,
    type ImageModelCapabilities,
    type ImageModelDefaultParams,
    type ImageModelEndpoint,
    type ImageRequestContract,
} from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../../db/entities/image-policy-config.entity";
import { CreateModelConfigDto, QueryModelConfigDto, UpdateModelConfigDto, ImageModelEndpointDto } from "../dto";
import {
    BUILT_IN_IMAGE_MODEL_CONFIGS,
    getBuiltInImageModel,
    type BuiltInImageModelConfig,
} from "./image-model-catalog";

export interface ResolvedImageModelConfig {
    id?: string;
    provider: string;
    model: string;
    externalModelId: string;
    requestContract: ImageRequestContract;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: ImageModelCapabilities;
    defaultParams: ImageModelDefaultParams;
    endpoints: ImageModelEndpoint[];
    sortOrder: number;
}

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
        private readonly secretService: SecretService,
    ) {
        super(modelConfigRepository);
    }

    async list(query: QueryModelConfigDto) {
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
        const missingModels = BUILT_IN_IMAGE_MODEL_CONFIGS
            .filter((config) => !configuredModels.has(config.model))
            .map((config) => config.model);
        return {
            expected: BUILT_IN_IMAGE_MODEL_CONFIGS.length,
            configured: configs.length,
            missingModels,
            complete: missingModels.length === 0,
        };
    }

    async findEnabledByModel(model: string): Promise<ResolvedImageModelConfig> {
        await this.ensureDefaultModelConfigs();
        const config = await this.modelConfigRepository.findOne({
            where: { model } as FindOptionsWhere<ImageModelConfig>,
        });
        if (!config) {
            throw HttpErrorFactory.badRequest(`不支持的图像模型: ${model}`);
        }
        if (!config.enabled || !config.visibleToUser) {
            throw HttpErrorFactory.badRequest(`图像模型已在管理后台禁用: ${model}`);
        }
        const resolved = this.toResolvedConfig(config);
        this.pickRuntimeEndpoint(resolved);
        return resolved;
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
        void dto;
        throw HttpErrorFactory.badRequest("图像模型由插件内置目录提供，请调整启用、可见性、排序、默认参数和接入点");
    }

    async updateConfig(id: string, dto: UpdateModelConfigDto) {
        const config = await this.findByIdOrFail(id);
        this.assertSupportedModelConfig(config.model);
        Object.assign(config, this.normalizeOperationalConfig(dto, config));
        const saved = await this.modelConfigRepository.save(config);
        return this.toOperationalView(saved);
    }

    async testEndpoint(id: string, endpointDto: ImageModelEndpointDto) {
        const config = await this.findByIdOrFail(id);
        this.assertSupportedModelConfig(config.model);
        const resolved = this.toResolvedConfig(config);
        const [endpoint] = this.normalizeEndpointConfigs([endpointDto], config.endpoints ?? [], true);
        const credential = await this.resolveEndpointCredential(endpoint);
        const { OpenAIImageClient } = await import("../../generation/services/openai-image-client");
        await new OpenAIImageClient({ apiKey: credential.apiKey, baseURL: credential.baseUrl }).testConnection(resolved.externalModelId, resolved.requestContract);
        return { success: true, message: "接入点配置可用" };
    }

    async deleteConfig(id: string) {
        void id;
        throw HttpErrorFactory.badRequest("内置图像模型不能删除，请使用停用或隐藏");
    }

    pickRuntimeEndpoint(config: ResolvedImageModelConfig): ImageModelEndpoint {
        const endpoint = (config.endpoints ?? [])
            .filter((item) => item.enabled && item.secretId)
            .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
        if (!endpoint) {
            throw HttpErrorFactory.badRequest(`模型 ${config.displayName} 未绑定可用主站密钥`);
        }
        return endpoint;
    }

    async resolveEndpointCredential(endpoint: ImageModelEndpoint) {
        if (!endpoint.secretId) {
            throw HttpErrorFactory.badRequest("请先为接入点选择主站密钥");
        }
        const secretConfig = await this.secretService.getConfigKeyValuePairs(endpoint.secretId);
        const values = this.flattenSecretConfig(secretConfig);
        const apiKey = this.pickFirst(values, ["apiKey", "api_key", "API_KEY", "key", "token"]);
        const baseUrl = endpoint.baseUrlOverride ||
            this.pickFirst(values, ["baseURL", "baseUrl", "base_url", "BASE_URL", "endpoint"]) ||
            "https://api.openai.com/v1";
        if (!apiKey) {
            throw HttpErrorFactory.badRequest("主站密钥中未找到 apiKey/api_key 字段");
        }
        return {
            apiKey,
            baseUrl: this.normalizeBaseUrl(baseUrl),
        };
    }

    async resolveRuntimeEndpoint(config: ResolvedImageModelConfig) {
        const endpoint = this.pickRuntimeEndpoint(config);
        const credential = await this.resolveEndpointCredential(endpoint);
        return { endpoint, ...credential };
    }

    toWebOption(config: ResolvedImageModelConfig | ImageModelConfig) {
        return {
            id: config.model,
            modelConfigId: "id" in config ? config.id : undefined,
            name: config.displayName,
            model: config.model,
            provider: config.provider,
            modelType: "image",
            description: config.description ?? "",
            mediaTypes: ["image"],
            capabilities: config.capabilities ?? {},
            defaultParams: config.defaultParams ?? {},
        };
    }

    private async ensureDefaultModelConfigs(): Promise<ImageModelConfig[]> {
        await this.ensureRuntimeSchema();
        const existing = await this.modelConfigRepository.find({
            where: {} as FindOptionsWhere<ImageModelConfig>,
        });
        const supportedExisting = existing.filter((config) => this.isSupportedModelConfig(config.model));
        const existingModels = new Set(supportedExisting.map((config) => config.model));
        const missing = BUILT_IN_IMAGE_MODEL_CONFIGS.filter((config) => !existingModels.has(config.model));
        if (missing.length === 0) return supportedExisting;

        const created = await this.modelConfigRepository.save(
            missing.map((config) => this.modelConfigRepository.create({
                provider: config.provider,
                model: config.model,
                externalModelId: config.externalModelId,
                requestContract: config.requestContract,
                displayName: config.displayName,
                description: config.description,
                enabled: config.enabled,
                visibleToUser: config.visibleToUser,
                capabilities: config.capabilities,
                defaultParams: config.defaultParams,
                allowedParams: config.allowedParams,
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
            ALTER TABLE "echoflow_image"."image_model_config"
            ADD COLUMN IF NOT EXISTS "provider" varchar(50) NOT NULL DEFAULT 'echoflow-api',
            ADD COLUMN IF NOT EXISTS "model" varchar(100),
            ADD COLUMN IF NOT EXISTS "external_model_id" varchar(100) NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS "request_contract" varchar(50) NOT NULL DEFAULT 'responses',
            ADD COLUMN IF NOT EXISTS "visible_to_user" boolean NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS "endpoints" jsonb NOT NULL DEFAULT '[]'
        `);
        await this.schemaReadyPromise;
    }

    private normalizeOperationalConfig(
        dto: UpdateModelConfigDto,
        existing?: ImageModelConfig,
    ) {
        const defaultConfig = getBuiltInImageModel(existing?.model ?? "");
        if (!existing || !defaultConfig) {
            throw HttpErrorFactory.badRequest("内置图像模型配置不存在");
        }

        return {
            provider: defaultConfig.provider,
            model: defaultConfig.model,
            externalModelId: defaultConfig.externalModelId,
            requestContract: defaultConfig.requestContract,
            displayName: dto.displayName ?? existing.displayName,
            description: dto.description ?? existing.description,
            enabled: dto.enabled ?? existing.enabled ?? true,
            visibleToUser: dto.visibleToUser ?? existing.visibleToUser ?? true,
            capabilities: {
                ...defaultConfig.capabilities,
                ...(existing.capabilities ?? {}),
                ...(dto.capabilities ?? {}),
            },
            defaultParams: {
                ...defaultConfig.defaultParams,
                ...(existing.defaultParams ?? {}),
                ...(dto.defaultParams ?? {}),
            },
            allowedParams: {
                ...defaultConfig.allowedParams,
                ...(existing.allowedParams ?? {}),
                ...(dto.allowedParams ?? {}),
            },
            endpoints: this.normalizeEndpointConfigs(dto.endpoints, existing.endpoints ?? []),
            sortOrder: dto.sortOrder ?? existing.sortOrder ?? defaultConfig.sortOrder,
        };
    }

    private normalizeEndpointConfigs(
        endpoints: ImageModelEndpointDto[] | undefined,
        existing: ImageModelEndpoint[],
        allowEmptyApiKey = true,
    ): ImageModelEndpoint[] {
        const source = endpoints?.length ? endpoints : existing;
        return source.map((endpoint, index) => ({
            id: endpoint.id || `endpoint-${index + 1}`,
            name: endpoint.name || `接入点 ${index + 1}`,
            secretId: endpoint.secretId || existing[index]?.secretId,
            secretName: endpoint.secretName || existing[index]?.secretName,
            baseUrlOverride: endpoint.baseUrlOverride
                ? this.normalizeBaseUrl(endpoint.baseUrlOverride)
                : existing[index]?.baseUrlOverride,
            enabled: endpoint.enabled ?? index === 0,
            priority: Number(endpoint.priority ?? 100 - index),
            requestTimeoutMs: Number(endpoint.requestTimeoutMs ?? 120000),
            testTimeoutMs: Number(endpoint.testTimeoutMs ?? 15000),
            maxRetries: Number(endpoint.maxRetries ?? 2),
            retryDelayMs: Number(endpoint.retryDelayMs ?? 1000),
        }));
    }

    private normalizeBaseUrl(value: string): string {
        const trimmed = value.trim().replace(/\/+$/, "");
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
        return trimmed;
    }

    private isSupportedModelConfig(model: string) {
        return Boolean(getBuiltInImageModel(model));
    }

    private assertSupportedModelConfig(model: string) {
        if (!this.isSupportedModelConfig(model)) {
            throw HttpErrorFactory.badRequest("不支持的内置图像模型");
        }
    }

    private hasUsableEndpoint(config: ResolvedImageModelConfig) {
        return (config.endpoints ?? []).some((item) => item.enabled && Boolean(item.secretId));
    }

    private toResolvedConfig(config: ImageModelConfig): ResolvedImageModelConfig {
        return {
            id: config.id,
            provider: config.provider,
            model: config.model,
            externalModelId: config.externalModelId,
            requestContract: config.requestContract,
            displayName: config.displayName,
            description: config.description,
            enabled: config.enabled,
            visibleToUser: config.visibleToUser,
            capabilities: config.capabilities,
            defaultParams: config.defaultParams,
            endpoints: config.endpoints ?? [],
            sortOrder: config.sortOrder,
        };
    }

    private toOperationalView(config: ImageModelConfig) {
        return {
            ...this.toResolvedConfig(config),
            endpoints: config.endpoints ?? [],
        };
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
}
