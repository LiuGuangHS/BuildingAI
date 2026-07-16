import type { OpenAIApiMode } from "@buildingai/ai-sdk";
import { HttpErrorFactory } from "@buildingai/errors";
import { getProviderSecret } from "@buildingai/utils";

import { assertPublicHttpUrl } from "../../utils/public-http-url";

export type ProviderSecretFieldValue =
    | string
    | { value?: unknown; required?: boolean }
    | undefined;

type ProviderSecretValue = { value: string; required: boolean };

const API_KEY_KEYS = new Set(["apiKey", "api_key", "API_KEY", "key", "token"]);
const BASE_URL_KEYS = new Set(["baseURL", "baseUrl", "base_url", "BASE_URL", "endpoint"]);
const API_MODE_KEYS = new Set(["apiMode", "api_mode", "API_MODE"]);
const WEBHOOK_SECRET_KEYS = new Set([
    "webhookSecret",
    "webhook_secret",
    "WEBHOOK_SECRET",
    "secret",
    "SECRET",
    "token",
    "TOKEN",
]);

export type NormalizedProviderConfig = {
    apiKey: string;
    baseURL: string;
    apiMode?: OpenAIApiMode;
    webhookSecret: string;
};

export type ProviderRuntimeConfig = {
    apiKey: string;
    baseURL?: string;
    apiMode?: OpenAIApiMode;
};

export type ProviderEndpointCredentialInput = {
    secretId?: string | null;
    baseUrlOverride?: string | null;
};

export type ProviderEndpointCredentialOptions = {
    defaultBaseUrl: string;
    label?: string;
    missingSecretMessage?: string;
    missingApiKeyMessage?: string;
    secretConfigResolver: (secretId: string) => Promise<Record<string, ProviderSecretFieldValue>>;
};

export type ProviderEndpointCredential = {
    apiKey: string;
    baseUrl: string;
};

export type ProviderSecretValueKey = keyof NormalizedProviderConfig;

export type ProviderSecretValueOptions = {
    secretId: string;
    field: ProviderSecretValueKey;
    missingSecretMessage?: string;
    missingValueMessage?: string;
    secretConfigResolver: (secretId: string) => Promise<Record<string, ProviderSecretFieldValue>>;
};

export function normalizeProviderConfig(
    config: Record<string, ProviderSecretFieldValue> = {},
): NormalizedProviderConfig {
    const providerSecretConfig = normalizeProviderSecretConfig(config);
    return {
        apiKey: getProviderSecret("apiKey", providerSecretConfig),
        baseURL: getProviderSecret("baseUrl", providerSecretConfig),
        apiMode: normalizeOpenAIApiMode(providerSecretConfig.apiMode?.value),
        webhookSecret: getProviderSecret("webhookSecret", providerSecretConfig),
    };
}

export function normalizeProviderRuntimeConfig(
    config: Record<string, ProviderSecretFieldValue> = {},
): ProviderRuntimeConfig {
    const values = normalizeProviderConfig(config);
    return {
        apiKey: values.apiKey,
        baseURL: values.baseURL || undefined,
        apiMode: values.apiMode,
    };
}

export async function resolveProviderEndpointCredential(
    input: ProviderEndpointCredentialInput,
    options: ProviderEndpointCredentialOptions,
): Promise<ProviderEndpointCredential> {
    const secretId = input.secretId?.trim();
    if (!secretId) {
        throw HttpErrorFactory.badRequest(options.missingSecretMessage || "请先为接入点选择主站密钥");
    }

    const secretConfig = await options.secretConfigResolver(secretId);
    const values = normalizeProviderConfig(secretConfig);
    const apiKey = values.apiKey;
    const baseUrl = input.baseUrlOverride || values.baseURL || options.defaultBaseUrl;
    if (!apiKey) {
        throw HttpErrorFactory.badRequest(options.missingApiKeyMessage || "主站密钥中未找到 apiKey/api_key 字段");
    }

    return {
        apiKey,
        baseUrl: await assertPublicHttpUrl(baseUrl, { label: options.label || "Base URL" }),
    };
}

export async function resolveProviderSecretValue(
    options: ProviderSecretValueOptions,
): Promise<string> {
    let secretConfig: Record<string, ProviderSecretFieldValue>;
    try {
        secretConfig = await options.secretConfigResolver(options.secretId);
    } catch {
        throw HttpErrorFactory.badRequest(options.missingSecretMessage || "主站密钥不存在或不可用");
    }

    const value = normalizeProviderConfig(secretConfig)[options.field];
    if (!value) {
        throw HttpErrorFactory.badRequest(options.missingValueMessage || `主站密钥中未找到 ${options.field} 字段`);
    }
    return value;
}

function normalizeOpenAIApiMode(value: string | undefined): OpenAIApiMode | undefined {
    if (value === "chat" || value === "responses") return value;
    return undefined;
}

function normalizeProviderSecretConfig(
    config: Record<string, ProviderSecretFieldValue>,
): Record<string, ProviderSecretValue> {
    const normalized: Record<string, ProviderSecretValue> = {};

    Object.entries(config).forEach(([key, item]) => {
        const value =
            typeof item === "string"
                ? item
                : typeof item?.value === "string"
                  ? item.value
                  : "";
        const required = typeof item === "object" && item?.required === true;
        if (API_KEY_KEYS.has(key)) {
            normalized.apiKey = { value, required };
        }
        if (BASE_URL_KEYS.has(key)) {
            normalized.baseUrl = { value, required };
        }
        if (API_MODE_KEYS.has(key)) {
            normalized.apiMode = { value, required };
        }
        if (WEBHOOK_SECRET_KEYS.has(key)) {
            normalized.webhookSecret = { value, required };
        }
    });

    return normalized;
}
