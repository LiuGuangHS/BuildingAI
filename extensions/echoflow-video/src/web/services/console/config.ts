import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export interface ProviderConfig {
    provider: string;
    promptOptimizerEnabled: boolean;
    promptOptimizerModelId: string;
    promptOptimizerAllowedModelIds: string[];
    updatedAt?: string;
}

export interface PromptOptimizerModelOption {
    id: string;
    name: string;
    model: string;
    modelType?: string;
    description?: string;
    features?: string[];
    isActive?: boolean;
    billingRule?: {
        power?: number;
        tokens?: number;
    };
    provider?: {
        id: string;
        name?: string;
        provider?: string;
        isActive?: boolean;
    };
}

export interface ProviderConfigAudit {
    id: string;
    action: string;
    operatorId?: string;
    snapshot: Record<string, unknown>;
    createdAt: string;
}

export interface UpdateProviderConfigParams {
    promptOptimizerEnabled?: boolean;
    promptOptimizerModelId?: string;
    clearPromptOptimizerModelId?: boolean;
    promptOptimizerAllowedModelIds?: string[];
}

export function useProviderConfigQuery(options?: QueryOptionsUtil<ProviderConfig>) {
    return useQuery<ProviderConfig>({
        queryKey: ["echoflow-video", "provider-config"],
        queryFn: () => consoleHttpClient.get<ProviderConfig>("/config"),
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

export function usePromptOptimizerModelsQuery(options?: QueryOptionsUtil<PromptOptimizerModelOption[]>) {
    return useQuery<PromptOptimizerModelOption[]>({
        queryKey: ["echoflow-video", "prompt-optimizer-models"],
        queryFn: () => consoleHttpClient.get<PromptOptimizerModelOption[]>("/config/prompt-optimizer-models"),
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
