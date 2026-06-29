import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type {
    CreateVideoParams,
    OptimizePromptParams,
    PromptOptimizerOptions,
    PromptOptimizationResult,
    QueryVideoParams,
    VideoGeneration,
    VideoModelOption,
} from "../types/generation";

export interface ProviderPublicStatus {
    available: boolean;
    configured: boolean;
    enabled: boolean;
}

async function quietly<T>(request: Promise<T>, fallback: T): Promise<T> {
    try {
        return await request;
    } catch {
        return fallback;
    }
}

// ---- Queries ----

export function useWebVideoModelOptionsQuery(options?: QueryOptionsUtil<VideoModelOption[]>) {
    return useQuery<VideoModelOption[]>({
        queryKey: ["echoflow-video", "web", "models"],
        queryFn: () => apiHttpClient.get<VideoModelOption[]>("/generation/options/models", { silent: true }),
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

export function useWebProviderStatusQuery(options?: QueryOptionsUtil<ProviderPublicStatus>) {
    return useQuery<ProviderPublicStatus>({
        queryKey: ["echoflow-video", "web", "provider-status"],
        queryFn: () =>
            quietly(
                apiHttpClient.get<ProviderPublicStatus>("/generation/options/provider-status", { silent: true }),
                { available: false, configured: false, enabled: false },
            ),
        staleTime: 60 * 1000,
        ...options,
    });
}

export function useWebPromptOptimizerOptionsQuery(options?: QueryOptionsUtil<PromptOptimizerOptions>) {
    return useQuery<PromptOptimizerOptions>({
        queryKey: ["echoflow-video", "web", "prompt-optimizer-options"],
        queryFn: () => apiHttpClient.get<PromptOptimizerOptions>("/generation/prompt/options", { silent: true }),
        staleTime: 60 * 1000,
        ...options,
    });
}

export function useWebVideoListQuery(
    params?: QueryVideoParams,
    options?: PaginatedQueryOptionsUtil<VideoGeneration>,
) {
    return useQuery({
        queryKey: ["echoflow-video", "web", "generations", params],
        queryFn: () => apiHttpClient.get<PaginatedResponse<VideoGeneration>>("/generation", { params, silent: true }),
        ...options,
    });
}

export function useWebVideoDetailQuery(id: string, options?: QueryOptionsUtil<VideoGeneration>) {
    return useQuery<VideoGeneration>({
        queryKey: ["echoflow-video", "web", "generation", id],
        queryFn: () => apiHttpClient.get<VideoGeneration>(`/generation/${id}`, { silent: true }),
        enabled: !!id && options?.enabled !== false,
        retry: false,
        ...options,
    });
}

/**
 * Poll the status of a video generation task (web user).
 * Adaptive interval: 3s → 6s → 10s → 20s based on elapsed time.
 */
export function useWebVideoStatusQuery(
    id: string | undefined,
    options?: QueryOptionsUtil<VideoGeneration>,
) {
    return useQuery<VideoGeneration>({
        queryKey: ["echoflow-video", "web", "generation", id, "status"],
        queryFn: () => apiHttpClient.get<VideoGeneration>(`/generation/${id}/status`, { silent: true }),
        enabled: !!id && options?.enabled !== false,
        retry: false,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data && (data.status === "succeeded" || data.status === "failed")) {
                return false;
            }
            // Adaptive interval based on time since startedAt
            const startedAt = data?.startedAt ? Date.parse(data.startedAt) : Date.now();
            const elapsedMs = Date.now() - startedAt;
            if (elapsedMs < 60_000) return 3_000;
            if (elapsedMs < 180_000) return 6_000;
            if (elapsedMs < 300_000) return 10_000;
            return 20_000;
        },
        ...options,
    });
}

// ---- Mutations ----

export function useWebRefreshVideoStatusMutation(options?: MutationOptionsUtil<VideoGeneration, string>) {
    return useMutation<VideoGeneration, Error, string>({
        mutationFn: (id) => apiHttpClient.get<VideoGeneration>(`/generation/${id}/status`, { silent: true }),
        ...options,
    });
}

export function useWebCreateVideoMutation(
    options?: MutationOptionsUtil<VideoGeneration, CreateVideoParams>,
) {
    return useMutation<VideoGeneration, Error, CreateVideoParams>({
        mutationFn: (data) => apiHttpClient.post<VideoGeneration>("/generation", data),
        ...options,
    });
}

export function useWebOptimizePromptMutation(
    options?: MutationOptionsUtil<PromptOptimizationResult, OptimizePromptParams>,
) {
    return useMutation<PromptOptimizationResult, Error, OptimizePromptParams>({
        mutationFn: (data) => apiHttpClient.post<PromptOptimizationResult>("/generation/prompt/optimize", data),
        ...options,
    });
}

export function useWebDeleteVideoMutation(options?: MutationOptionsUtil<{ success: boolean; message: string }, string>) {
    return useMutation<{ success: boolean; message: string }, Error, string>({
        mutationFn: (id) => apiHttpClient.delete<{ success: boolean; message: string }>(`/generation/${id}`),
        ...options,
    });
}
