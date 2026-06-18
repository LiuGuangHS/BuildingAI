import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { maskSensitiveValue } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { encryptApiKey, decryptApiKey } from "../../../common/crypto/encryption";
import { PromptTemplate, VideoProviderConfig } from "../../../db/entities/video-provider-config.entity";
import { VideoConfigAudit } from "../../../db/entities/video-config-audit.entity";
import { UpdateProviderConfigDto } from "../dto";
import {
    HappyHorseClient,
    defaultHappyHorseClientOptions,
    type HappyHorseClientOptions,
} from "./happyhorse-client";

const HAPPYHORSE_PROVIDER = "happyhorse";

export interface HappyHorseRuntimeConfig {
    apiKey: string;
    clientOptions: Required<HappyHorseClientOptions>;
}

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
                enabled: false,
                configured: false,
                apiKeyMasked: "",
                baseUrl: defaultHappyHorseClientOptions.baseUrl,
                requestTimeoutMs: defaultHappyHorseClientOptions.requestTimeoutMs,
                testTimeoutMs: defaultHappyHorseClientOptions.testTimeoutMs,
                maxRetries: defaultHappyHorseClientOptions.maxRetries,
                retryDelayMs: defaultHappyHorseClientOptions.retryDelayMs,
                webhookSecretConfigured: false,
                webhookSecretMasked: "",
                promptOptimizerEnabled: true,
                promptOptimizerModelId: "",
                promptOptimizerAllowedModelIds: [],
                promptOptimizerBillingEnabled: true,
                promptOptimizerBillingPower: 1,
                promptOptimizerBillingTokens: 1000,
                promptOptimizerEstimatedTokens: 500,
            };
        }

        const plainKey = config.apiKey ? decryptApiKey(config.apiKey) : "";
        const webhookSecret = this.decryptOptional(config.webhookSecret);
        return {
            provider: config.provider,
            enabled: config.enabled,
            configured: Boolean(plainKey),
            apiKeyMasked: maskSensitiveValue(plainKey),
            baseUrl: config.baseUrl || defaultHappyHorseClientOptions.baseUrl,
            requestTimeoutMs: config.requestTimeoutMs ?? defaultHappyHorseClientOptions.requestTimeoutMs,
            testTimeoutMs: config.testTimeoutMs ?? defaultHappyHorseClientOptions.testTimeoutMs,
            maxRetries: config.maxRetries ?? defaultHappyHorseClientOptions.maxRetries,
            retryDelayMs: config.retryDelayMs ?? defaultHappyHorseClientOptions.retryDelayMs,
            webhookSecretConfigured: Boolean(webhookSecret),
            webhookSecretMasked: webhookSecret ? maskSensitiveValue(webhookSecret) : "",
            promptOptimizerEnabled: config.promptOptimizerEnabled ?? true,
            promptOptimizerModelId: config.promptOptimizerModelId ?? "",
            promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
            promptOptimizerBillingEnabled: config.promptOptimizerBillingEnabled ?? true,
            promptOptimizerBillingPower: config.promptOptimizerBillingPower ?? 1,
            promptOptimizerBillingTokens: config.promptOptimizerBillingTokens ?? 1000,
            promptOptimizerEstimatedTokens: config.promptOptimizerEstimatedTokens ?? 500,
            templates: config.templates || [],
            updatedAt: config.updatedAt,
        };
    }

    async getPublicTemplates() {
        const config = await this.findHappyHorseConfig();
        if (!config?.templates?.length) return [];
        return config.templates;
    }

    async getPublicStatus() {
        const config = await this.findHappyHorseConfig();
        const plainKey = config?.apiKey ? decryptApiKey(config.apiKey) : "";
        return {
            available: Boolean(plainKey && config?.enabled),
            configured: Boolean(plainKey),
            enabled: Boolean(config?.enabled),
        };
    }

    async updateConsoleConfig(dto: UpdateProviderConfigDto, operatorId?: string) {
        const existing = await this.findHappyHorseConfig();
        const config = existing ?? this.configRepository.create({ provider: HAPPYHORSE_PROVIDER });

        if (dto.apiKey) {
            config.apiKey = encryptApiKey(dto.apiKey);
        }
        config.baseUrl = this.normalizeBaseUrl(dto.baseUrl ?? config.baseUrl ?? defaultHappyHorseClientOptions.baseUrl);
        config.requestTimeoutMs = this.normalizeInteger(
            dto.requestTimeoutMs ?? config.requestTimeoutMs ?? defaultHappyHorseClientOptions.requestTimeoutMs,
            3000,
            300000,
            "请求超时",
        );
        config.testTimeoutMs = this.normalizeInteger(
            dto.testTimeoutMs ?? config.testTimeoutMs ?? defaultHappyHorseClientOptions.testTimeoutMs,
            3000,
            60000,
            "测试超时",
        );
        config.maxRetries = this.normalizeInteger(
            dto.maxRetries ?? config.maxRetries ?? defaultHappyHorseClientOptions.maxRetries,
            0,
            5,
            "重试次数",
        );
        config.retryDelayMs = this.normalizeInteger(
            dto.retryDelayMs ?? config.retryDelayMs ?? defaultHappyHorseClientOptions.retryDelayMs,
            100,
            10000,
            "重试延迟",
        );
        if (dto.clearWebhookSecret) {
            config.webhookSecret = undefined;
        } else if (dto.webhookSecret) {
            config.webhookSecret = encryptApiKey(dto.webhookSecret);
        }
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
        config.promptOptimizerBillingEnabled =
            dto.promptOptimizerBillingEnabled ?? config.promptOptimizerBillingEnabled ?? true;
        config.promptOptimizerBillingPower = this.normalizeInteger(
            dto.promptOptimizerBillingPower ?? config.promptOptimizerBillingPower ?? 1,
            1,
            100000,
            "提示词优化兜底算力",
        );
        config.promptOptimizerBillingTokens = this.normalizeInteger(
            dto.promptOptimizerBillingTokens ?? config.promptOptimizerBillingTokens ?? 1000,
            1,
            1000000,
            "提示词优化兜底 tokens",
        );
        config.promptOptimizerEstimatedTokens = this.normalizeInteger(
            dto.promptOptimizerEstimatedTokens ?? config.promptOptimizerEstimatedTokens ?? 500,
            50,
            20000,
            "提示词优化预检 tokens",
        );
        config.enabled = dto.enabled ?? config.enabled ?? true;
        if (dto.templates) {
            config.templates = this.normalizeTemplates(dto.templates);
        }
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

    async testConsoleConfig(dto: Partial<UpdateProviderConfigDto> = {}) {
        const config = await this.findHappyHorseConfig();
        const key = dto.apiKey?.trim() || (config?.apiKey ? decryptApiKey(config.apiKey) : "");
        if (!key) {
            throw HttpErrorFactory.badRequest("请先配置 HappyHorse API Key");
        }

        await new HappyHorseClient(key, this.resolveClientOptions(config, dto)).testConnection();
        return { success: true, message: "HappyHorse 配置可用" };
    }

    async getHappyHorseApiKey() {
        const config = await this.findHappyHorseConfig();
        const plainKey = config?.apiKey ? decryptApiKey(config.apiKey) : "";
        if (!plainKey || !config?.enabled) {
            throw HttpErrorFactory.badRequest("HappyHorse 未配置或未启用，请在 Echoflow Video 管理后台完成配置");
        }
        return plainKey;
    }

    async getHappyHorseRuntimeConfig(): Promise<HappyHorseRuntimeConfig> {
        const config = await this.findHappyHorseConfig();
        const apiKey = config?.apiKey ? decryptApiKey(config.apiKey) : "";
        if (!apiKey || !config?.enabled) {
            throw HttpErrorFactory.badRequest("HappyHorse 未配置或未启用，请在 Echoflow Video 管理后台完成配置");
        }

        return {
            apiKey,
            clientOptions: this.resolveClientOptions(config),
        };
    }

    async verifyHappyHorseWebhookSecret(secret?: string): Promise<boolean> {
        const config = await this.findHappyHorseConfig();
        const expectedSecret = this.decryptOptional(config?.webhookSecret);
        if (!expectedSecret) {
            return false;
        }
        return Boolean(secret && secret === expectedSecret);
    }

    private findHappyHorseConfig() {
        return this.configRepository.findOne({
            where: { provider: HAPPYHORSE_PROVIDER } as FindOptionsWhere<VideoProviderConfig>,
        });
    }

    private normalizeTemplates(templates: PromptTemplate[]): PromptTemplate[] {
        return templates
            .map((template) => ({
                label: template.label.trim().slice(0, 80),
                prompt: template.prompt.trim().slice(0, 1000),
            }))
            .filter((template) => template.label && template.prompt);
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

    private resolveClientOptions(
        config?: VideoProviderConfig | null,
        override: Partial<UpdateProviderConfigDto> = {},
    ): Required<HappyHorseClientOptions> {
        return {
            baseUrl: this.normalizeBaseUrl(
                override.baseUrl ?? config?.baseUrl ?? defaultHappyHorseClientOptions.baseUrl,
            ),
            requestTimeoutMs:
                this.normalizeInteger(
                    override.requestTimeoutMs ??
                    config?.requestTimeoutMs ??
                    defaultHappyHorseClientOptions.requestTimeoutMs,
                    3000,
                    300000,
                    "请求超时",
                ),
            testTimeoutMs:
                this.normalizeInteger(
                    override.testTimeoutMs ??
                    config?.testTimeoutMs ??
                    defaultHappyHorseClientOptions.testTimeoutMs,
                    3000,
                    60000,
                    "测试超时",
                ),
            maxRetries:
                this.normalizeInteger(
                    override.maxRetries ??
                    config?.maxRetries ??
                    defaultHappyHorseClientOptions.maxRetries,
                    0,
                    5,
                    "重试次数",
                ),
            retryDelayMs:
                this.normalizeInteger(
                    override.retryDelayMs ??
                    config?.retryDelayMs ??
                    defaultHappyHorseClientOptions.retryDelayMs,
                    100,
                    10000,
                    "重试延迟",
                ),
        };
    }

    private normalizeBaseUrl(value: string): string {
        const trimmed = value.trim().replace(/\/+$/, "");
        if (!trimmed) {
            throw HttpErrorFactory.badRequest("HappyHorse Base URL 不能为空");
        }

        let url: URL;
        try {
            url = new URL(trimmed);
        } catch {
            throw HttpErrorFactory.badRequest("HappyHorse Base URL 格式不正确");
        }

        if (!["http:", "https:"].includes(url.protocol)) {
            throw HttpErrorFactory.badRequest("HappyHorse Base URL 仅支持 http/https");
        }
        if (url.username || url.password) {
            throw HttpErrorFactory.badRequest("HappyHorse Base URL 不允许包含用户名或密码");
        }
        if (this.isPrivateOrLocalHost(url.hostname)) {
            throw HttpErrorFactory.badRequest("HappyHorse Base URL 不允许指向本机或内网地址");
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

    private decryptOptional(value?: string | null): string {
        return value ? decryptApiKey(value) : "";
    }

    private async writeAudit(action: string, config: VideoProviderConfig, operatorId?: string): Promise<void> {
        await this.auditRepository.save(
            this.auditRepository.create({
                action,
                operatorId,
                snapshot: {
                    provider: config.provider,
                    enabled: config.enabled,
                    configured: Boolean(config.apiKey),
                    baseUrl: config.baseUrl,
                    requestTimeoutMs: config.requestTimeoutMs,
                    testTimeoutMs: config.testTimeoutMs,
                    maxRetries: config.maxRetries,
                    retryDelayMs: config.retryDelayMs,
                    webhookSecretConfigured: Boolean(config.webhookSecret),
                    promptOptimizerEnabled: config.promptOptimizerEnabled,
                    promptOptimizerModelId: config.promptOptimizerModelId,
                    promptOptimizerAllowedModelIds: config.promptOptimizerAllowedModelIds ?? [],
                    promptOptimizerBillingEnabled: config.promptOptimizerBillingEnabled,
                    promptOptimizerBillingPower: config.promptOptimizerBillingPower,
                    promptOptimizerBillingTokens: config.promptOptimizerBillingTokens,
                    promptOptimizerEstimatedTokens: config.promptOptimizerEstimatedTokens,
                },
            }),
        );
    }
}
