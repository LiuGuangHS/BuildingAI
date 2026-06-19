import { getProviderSecret } from "@buildingai/utils";

export type ProviderSecretFieldValue =
    | string
    | { value?: unknown; required?: boolean }
    | undefined;

type ProviderSecretValue = { value: string; required: boolean };

const API_KEY_KEYS = new Set(["apiKey", "api_key", "API_KEY", "key", "token"]);
const BASE_URL_KEYS = new Set(["baseURL", "baseUrl", "base_url", "BASE_URL", "endpoint"]);
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
    webhookSecret: string;
};

export function normalizeProviderConfig(
    config: Record<string, ProviderSecretFieldValue> = {},
): NormalizedProviderConfig {
    const providerSecretConfig = normalizeProviderSecretConfig(config);
    return {
        apiKey: getProviderSecret("apiKey", providerSecretConfig),
        baseURL: getProviderSecret("baseUrl", providerSecretConfig),
        webhookSecret: getProviderSecret("webhookSecret", providerSecretConfig),
    };
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
        if (WEBHOOK_SECRET_KEYS.has(key)) {
            normalized.webhookSecret = { value, required };
        }
    });

    return normalized;
}
