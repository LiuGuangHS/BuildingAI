import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type {
    CreateGenerationParams,
    ImageGeneration,
    ImageModelOption,
    PromptEnhanceParams,
    PromptEnhanceResult,
    QueryGenerationParams,
} from "../types/generation";
import type { OperationResult } from "../types/common";

const queryDefaults = {
    retry: false,
    staleTime: 30_000,
} as const;

export function useWebImageModelOptionsQuery(options?: QueryOptionsUtil<ImageModelOption[]>) {
    return useQuery<ImageModelOption[]>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "web", "models"],
        queryFn: () => apiHttpClient.get<ImageModelOption[]>("/model-options"),
        ...options,
    });
}

export function useWebGenerationListQuery(
    params?: QueryGenerationParams,
    options?: PaginatedQueryOptionsUtil<ImageGeneration>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "web", "generations", params],
        queryFn: () => apiHttpClient.get<PaginatedResponse<ImageGeneration>>("/generation", { params }),
        ...options,
    });
}

export function useWebGenerationDetailQuery(id: string, options?: QueryOptionsUtil<ImageGeneration>) {
    return useQuery<ImageGeneration>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "web", "generation", id],
        queryFn: () => apiHttpClient.get<ImageGeneration>(`/generation/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useWebCreateGenerationMutation(
    options?: MutationOptionsUtil<ImageGeneration, CreateGenerationParams>,
) {
    return useMutation<ImageGeneration, Error, CreateGenerationParams>({
        mutationFn: (data) => apiHttpClient.post<ImageGeneration>("/generation", data),
        ...options,
    });
}

export function useWebDeleteGenerationMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => apiHttpClient.delete<OperationResult>(`/generation/${id}`),
        ...options,
    });
}

export function useWebRetryGenerationMutation(options?: MutationOptionsUtil<ImageGeneration, string>) {
    return useMutation<ImageGeneration, Error, string>({
        mutationFn: (id) => apiHttpClient.post<ImageGeneration>(`/generation/${id}/retry`),
        ...options,
    });
}

export function useWebPromptEnhanceMutation(options?: MutationOptionsUtil<PromptEnhanceResult, PromptEnhanceParams>) {
    return useMutation<PromptEnhanceResult, Error, PromptEnhanceParams>({
        mutationFn: (data) => apiHttpClient.post<PromptEnhanceResult>("/generation/prompt/enhance", data),
        ...options,
    });
}
