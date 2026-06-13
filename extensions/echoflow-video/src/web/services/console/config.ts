import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export interface ProviderConfig {
    provider: string;
    enabled: boolean;
    configured: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    requestTimeoutMs: number;
    testTimeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    webhookSecretConfigured: boolean;
    webhookSecretMasked: string;
    promptOptimizerEnabled: boolean;
    promptOptimizerModelId: string;
    promptOptimizerAllowedModelIds: string[];
    promptOptimizerBillingEnabled: boolean;
    promptOptimizerBillingPower: number;
    promptOptimizerBillingTokens: number;
    promptOptimizerEstimatedTokens: number;
    templates?: PromptTemplate[];
    updatedAt?: string;
}

export interface VideoProviderDescriptor {
    providerId: string;
    displayName: string;
    enabled: boolean;
    status: "ready" | "reserved";
    description: string;
}

export interface PromptTemplate {
    label: string;
    prompt: string;
}

export interface ProviderConfigAudit {
    id: string;
    action: string;
    operatorId?: string;
    snapshot: Record<string, unknown>;
    createdAt: string;
}

export interface UpdateProviderConfigParams {
    apiKey?: string;
    baseUrl?: string;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    webhookSecret?: string;
    clearWebhookSecret?: boolean;
    promptOptimizerEnabled?: boolean;
    promptOptimizerModelId?: string;
    clearPromptOptimizerModelId?: boolean;
    promptOptimizerAllowedModelIds?: string[];
    promptOptimizerBillingEnabled?: boolean;
    promptOptimizerBillingPower?: number;
    promptOptimizerBillingTokens?: number;
    promptOptimizerEstimatedTokens?: number;
    enabled?: boolean;
    templates?: PromptTemplate[];
}

export function useProviderConfigQuery(options?: QueryOptionsUtil<ProviderConfig>) {
    return useQuery<ProviderConfig>({
        queryKey: ["echoflow-video", "provider-config"],
        queryFn: () => consoleHttpClient.get<ProviderConfig>("/config"),
        ...options,
    });
}

export function useProviderRegistryQuery(options?: QueryOptionsUtil<VideoProviderDescriptor[]>) {
    return useQuery<VideoProviderDescriptor[]>({
        queryKey: ["echoflow-video", "provider-registry"],
        queryFn: () => consoleHttpClient.get<VideoProviderDescriptor[]>("/config/providers"),
        ...options,
    });
}

export function useProviderConfigAuditsQuery(options?: QueryOptionsUtil<ProviderConfigAudit[]>) {
    return useQuery<ProviderConfigAudit[]>({
        queryKey: ["echoflow-video", "provider-config-audits"],
        queryFn: () => consoleHttpClient.get<ProviderConfigAudit[]>("/config/audits", { params: { limit: 30 } }),
        staleTime: 30_000,
        ...options,
    });
}

export function useUpdateProviderConfigMutation(
    options?: MutationOptionsUtil<ProviderConfig, UpdateProviderConfigParams>,
) {
    return useMutation<ProviderConfig, Error, UpdateProviderConfigParams>({
        mutationFn: (data) => consoleHttpClient.post<ProviderConfig>("/config", data),
        ...options,
    });
}

export function useTestProviderConfigMutation(
    options?: MutationOptionsUtil<{ success: boolean; message: string }, Partial<UpdateProviderConfigParams>>,
) {
    return useMutation<{ success: boolean; message: string }, Error, Partial<UpdateProviderConfigParams>>({
        mutationFn: (data) => consoleHttpClient.post<{ success: boolean; message: string }>("/config/test", data),
        ...options,
    });
}

export function useClearProviderConfigMutation(options?: MutationOptionsUtil<ProviderConfig, void>) {
    return useMutation<ProviderConfig, Error, void>({
        mutationFn: () => consoleHttpClient.delete<ProviderConfig>("/config"),
        ...options,
    });
}
