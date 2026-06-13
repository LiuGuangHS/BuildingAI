import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type {
    CreateGenerationParams,
    ImageGeneration,
    ImageModelOption,
    PromptEnhanceParams,
    PromptEnhanceResult,
    QueryGenerationParams,
} from "../types/generation";
import type { OperationResult } from "../types/common";

/** Default options to avoid spamming 401s and stale data. */
const queryDefaults = {
    retry: false,
    staleTime: 30_000,
} as const;

export function useImageModelOptionsQuery(options?: QueryOptionsUtil<ImageModelOption[]>) {
    return useQuery<ImageModelOption[]>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "models"],
        queryFn: () => consoleHttpClient.get<ImageModelOption[]>("/generation/options/models"),
        ...options,
    });
}

export function useGenerationListQuery(
    params?: QueryGenerationParams,
    options?: PaginatedQueryOptionsUtil<ImageGeneration>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "generations", params],
        queryFn: () =>
            consoleHttpClient.get<PaginatedResponse<ImageGeneration>>("/generation", { params }),
        ...options,
    });
}

export function useGenerationDetailQuery(id: string, options?: QueryOptionsUtil<ImageGeneration>) {
    return useQuery<ImageGeneration>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "generation", id],
        queryFn: () => consoleHttpClient.get<ImageGeneration>(`/generation/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useCreateGenerationMutation(
    options?: MutationOptionsUtil<ImageGeneration, CreateGenerationParams>,
) {
    return useMutation<ImageGeneration, Error, CreateGenerationParams>({
        mutationFn: (data) => consoleHttpClient.post<ImageGeneration>("/generation", data),
        ...options,
    });
}

export function useDeleteGenerationMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/generation/${id}`),
        ...options,
    });
}

export function useRetryGenerationMutation(options?: MutationOptionsUtil<ImageGeneration, string>) {
    return useMutation<ImageGeneration, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<ImageGeneration>(`/generation/${id}/retry`),
        ...options,
    });
}

export function usePromptEnhanceMutation(options?: MutationOptionsUtil<PromptEnhanceResult, PromptEnhanceParams>) {
    return useMutation<PromptEnhanceResult, Error, PromptEnhanceParams>({
        mutationFn: (data) => consoleHttpClient.post<PromptEnhanceResult>("/generation/prompt/enhance", data),
        ...options,
    });
}

export function useRecoverGenerationJobsMutation(options?: MutationOptionsUtil<{ resumed: number; timedOut: number }, void>) {
    return useMutation<{ resumed: number; timedOut: number }, Error, void>({
        mutationFn: () => consoleHttpClient.post<{ resumed: number; timedOut: number }>("/generation/jobs/recover"),
        ...options,
    });
}
