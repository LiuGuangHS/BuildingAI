import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
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
            apiKeyMasked: this.maskApiKey(plainKey),
            baseUrl: config.baseUrl || defaultHappyHorseClientOptions.baseUrl,
            requestTimeoutMs: config.requestTimeoutMs ?? defaultHappyHorseClientOptions.requestTimeoutMs,
            testTimeoutMs: config.testTimeoutMs ?? defaultHappyHorseClientOptions.testTimeoutMs,
            maxRetries: config.maxRetries ?? defaultHappyHorseClientOptions.maxRetries,
            retryDelayMs: config.retryDelayMs ?? defaultHappyHorseClientOptions.retryDelayMs,
            webhookSecretConfigured: Boolean(webhookSecret),
            webhookSecretMasked: webhookSecret ? this.maskApiKey(webhookSecret) : "",
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

        if (!dto.apiKey && !existing?.apiKey) {
            throw HttpErrorFactory.badRequest("请先配置 HappyHorse API Key");
        }

        if (dto.apiKey) {
            config.apiKey = encryptApiKey(dto.apiKey);
        }
        config.baseUrl = this.normalizeBaseUrl(dto.baseUrl ?? config.baseUrl ?? defaultHappyHorseClientOptions.baseUrl);
        config.requestTimeoutMs = dto.requestTimeoutMs ?? config.requestTimeoutMs ?? defaultHappyHorseClientOptions.requestTimeoutMs;
        config.testTimeoutMs = dto.testTimeoutMs ?? config.testTimeoutMs ?? defaultHappyHorseClientOptions.testTimeoutMs;
        config.maxRetries = dto.maxRetries ?? config.maxRetries ?? defaultHappyHorseClientOptions.maxRetries;
        config.retryDelayMs = dto.retryDelayMs ?? config.retryDelayMs ?? defaultHappyHorseClientOptions.retryDelayMs;
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
        if (dto.promptOptimizerAllowedModelIds) {
            config.promptOptimizerAllowedModelIds = this.normalizeModelIds(dto.promptOptimizerAllowedModelIds);
        }
        config.promptOptimizerBillingEnabled =
            dto.promptOptimizerBillingEnabled ?? config.promptOptimizerBillingEnabled ?? true;
        config.promptOptimizerBillingPower =
            dto.promptOptimizerBillingPower ?? config.promptOptimizerBillingPower ?? 1;
        config.promptOptimizerBillingTokens =
            dto.promptOptimizerBillingTokens ?? config.promptOptimizerBillingTokens ?? 1000;
        config.promptOptimizerEstimatedTokens =
            dto.promptOptimizerEstimatedTokens ?? config.promptOptimizerEstimatedTokens ?? 500;
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

    private maskApiKey(apiKey: string) {
        if (apiKey.length <= 8) return "********";
        return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
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
                override.requestTimeoutMs ??
                config?.requestTimeoutMs ??
                defaultHappyHorseClientOptions.requestTimeoutMs,
            testTimeoutMs:
                override.testTimeoutMs ??
                config?.testTimeoutMs ??
                defaultHappyHorseClientOptions.testTimeoutMs,
            maxRetries:
                override.maxRetries ??
                config?.maxRetries ??
                defaultHappyHorseClientOptions.maxRetries,
            retryDelayMs:
                override.retryDelayMs ??
                config?.retryDelayMs ??
                defaultHappyHorseClientOptions.retryDelayMs,
        };
    }

    private normalizeBaseUrl(value: string): string {
        return value.trim().replace(/\/+$/, "");
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
