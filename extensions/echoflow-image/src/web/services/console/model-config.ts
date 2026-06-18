import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OperationResult } from "../types/common";
import type { ImageModelConfig, ImageModelEndpoint, SaveModelConfigParams } from "../types/model-config";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleModelConfigsQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; enabled?: boolean },
    options?: PaginatedQueryOptionsUtil<ImageModelConfig>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "console", "model-configs", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<ImageModelConfig>>("/model-configs", { params }),
        ...options,
    });
}

export function useConsoleModelConfigQuery(id: string, options?: QueryOptionsUtil<ImageModelConfig>) {
    return useQuery<ImageModelConfig>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "console", "model-config", id],
        queryFn: () => consoleHttpClient.get<ImageModelConfig>(`/model-configs/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useCreateModelConfigMutation(options?: MutationOptionsUtil<ImageModelConfig, SaveModelConfigParams>) {
    return useMutation<ImageModelConfig, Error, SaveModelConfigParams>({
        mutationFn: (data) => consoleHttpClient.post<ImageModelConfig>("/model-configs", data),
        ...options,
    });
}

export function useUpdateModelConfigMutation(
    options?: MutationOptionsUtil<ImageModelConfig, { id: string; data: SaveModelConfigParams }>,
) {
    return useMutation<ImageModelConfig, Error, { id: string; data: SaveModelConfigParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<ImageModelConfig>(`/model-configs/${id}`, data),
        ...options,
    });
}

export function useDeleteModelConfigMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/model-configs/${id}`),
        ...options,
    });
}

export function useTestModelEndpointMutation(
    options?: MutationOptionsUtil<OperationResult, { id: string; data: ImageModelEndpoint }>,
) {
    return useMutation<OperationResult, Error, { id: string; data: ImageModelEndpoint }>({
        mutationFn: ({ id, data }) => consoleHttpClient.post<OperationResult>(`/model-configs/${id}/test-endpoint`, data),
        ...options,
    });
}
