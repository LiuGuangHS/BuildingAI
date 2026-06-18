import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OperationResult, SaveVideoModelConfigParams, VideoModelConfig, VideoModelEndpoint } from "../types/generation";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleVideoModelConfigsQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; enabled?: boolean },
    options?: PaginatedQueryOptionsUtil<VideoModelConfig>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-video", "console", "model-configs", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<VideoModelConfig>>("/models", { params }),
        ...options,
    });
}

export function useUpdateVideoModelConfigMutation(
    options?: MutationOptionsUtil<VideoModelConfig, { id: string; data: SaveVideoModelConfigParams }>,
) {
    return useMutation<VideoModelConfig, Error, { id: string; data: SaveVideoModelConfigParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<VideoModelConfig>(`/models/${id}`, data),
        ...options,
    });
}

export function useTestVideoModelEndpointMutation(
    options?: MutationOptionsUtil<OperationResult, { id: string; data: VideoModelEndpoint }>,
) {
    return useMutation<OperationResult, Error, { id: string; data: VideoModelEndpoint }>({
        mutationFn: ({ id, data }) => consoleHttpClient.post<OperationResult>(`/models/${id}/test-endpoint`, data),
        ...options,
    });
}
