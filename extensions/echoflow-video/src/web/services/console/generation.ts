import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type {
    QueryVideoParams,
    VideoGeneration,
    VideoModelOption,
} from "../types/generation";

export interface VideoHealthStatus {
    status: "ok" | "attention" | string;
    enabledModelCount: number;
    missingEndpointModels?: string[];
    modelCompleteness?: {
        expected: number;
        configured: number;
        enabledVisible: number;
        missingModels: string[];
        unverifiedModels: string[];
        complete: boolean;
    };
    activeTasks: number;
    recentFailures?: {
        windowHours: number;
        total: number;
        provider5xx: number;
        byCategory: Record<string, number>;
    };
    checkedAt: string;
}

// ---- Queries ----

export function useVideoModelOptionsQuery(options?: QueryOptionsUtil<VideoModelOption[]>) {
    return useQuery<VideoModelOption[]>({
        queryKey: ["echoflow-video", "models"],
        queryFn: () => consoleHttpClient.get<VideoModelOption[]>("/generation/options/models"),
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

export function useVideoListQuery(
    params?: QueryVideoParams,
    options?: PaginatedQueryOptionsUtil<VideoGeneration>,
) {
    return useQuery({
        queryKey: ["echoflow-video", "generations", params],
        queryFn: () =>
            consoleHttpClient.get<PaginatedResponse<VideoGeneration>>("/generation", { params }),
        ...options,
    });
}

export function useVideoDetailQuery(id: string, options?: QueryOptionsUtil<VideoGeneration>) {
    return useQuery<VideoGeneration>({
        queryKey: ["echoflow-video", "generation", id],
        queryFn: () => consoleHttpClient.get<VideoGeneration>(`/generation/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useVideoHealthQuery(options?: QueryOptionsUtil<VideoHealthStatus>) {
    return useQuery<VideoHealthStatus>({
        queryKey: ["echoflow-video", "health"],
        queryFn: () => consoleHttpClient.get<VideoHealthStatus>("/generation/health"),
        retry: false,
        staleTime: 30_000,
        ...options,
    });
}

// ---- Mutations ----

export function useRefreshVideoStatusMutation(options?: MutationOptionsUtil<VideoGeneration, string>) {
    return useMutation<VideoGeneration, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<VideoGeneration>(`/generation/${id}/status`, {}),
        ...options,
    });
}

export function useDeleteVideoMutation(options?: MutationOptionsUtil<{ success: boolean; message: string }, string>) {
    return useMutation<{ success: boolean; message: string }, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<{ success: boolean; message: string }>(`/generation/${id}`),
        ...options,
    });
}

export function useUpdateVideoRemarkMutation(
    options?: MutationOptionsUtil<VideoGeneration, { id: string; adminRemark: string }>,
) {
    return useMutation<VideoGeneration, Error, { id: string; adminRemark: string }>({
        mutationFn: ({ id, adminRemark }) =>
            consoleHttpClient.post<VideoGeneration>(`/generation/${id}/remark`, { adminRemark }),
        ...options,
    });
}

export function useMarkVideoStatusMutation(
    options?: MutationOptionsUtil<
        VideoGeneration,
        { id: string; status: string; message?: string; failureCategory?: string }
    >,
) {
    return useMutation<
        VideoGeneration,
        Error,
        { id: string; status: string; message?: string; failureCategory?: string }
    >({
        mutationFn: ({ id, ...data }) =>
            consoleHttpClient.post<VideoGeneration>(`/generation/${id}/mark-status`, data),
        ...options,
    });
}

export function useCancelVideoMutation(options?: MutationOptionsUtil<VideoGeneration, string>) {
    return useMutation<VideoGeneration, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<VideoGeneration>(`/generation/${id}/cancel`, {}),
        ...options,
    });
}

export function useRetryVideoMutation(options?: MutationOptionsUtil<VideoGeneration, string>) {
    return useMutation<VideoGeneration, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<VideoGeneration>(`/generation/${id}/retry`, {}),
        ...options,
    });
}

export function useBatchMarkFailedMutation(
    options?: MutationOptionsUtil<{ total: number; updated: number; items: VideoGeneration[] }, string[]>,
) {
    return useMutation<{ total: number; updated: number; items: VideoGeneration[] }, Error, string[]>({
        mutationFn: (ids) =>
            consoleHttpClient.post<{ total: number; updated: number; items: VideoGeneration[] }>(
                "/generation/batch/mark-failed",
                { ids },
            ),
        ...options,
    });
}

export function useBatchCancelVideoMutation(
    options?: MutationOptionsUtil<{ total: number; updated: number; items: VideoGeneration[] }, string[]>,
) {
    return useMutation<{ total: number; updated: number; items: VideoGeneration[] }, Error, string[]>({
        mutationFn: (ids) =>
            consoleHttpClient.post<{ total: number; updated: number; items: VideoGeneration[] }>(
                "/generation/batch/cancel",
                { ids },
            ),
        ...options,
    });
}

export function useBatchRetryVideoMutation(
    options?: MutationOptionsUtil<{ total: number; created: number; items: VideoGeneration[] }, string[]>,
) {
    return useMutation<{ total: number; created: number; items: VideoGeneration[] }, Error, string[]>({
        mutationFn: (ids) =>
            consoleHttpClient.post<{ total: number; created: number; items: VideoGeneration[] }>(
                "/generation/batch/retry",
                { ids },
            ),
        ...options,
    });
}

export function useScanStaleVideoMutation(
    options?: MutationOptionsUtil<{ total: number; updated: VideoGeneration[] }, void>,
) {
    return useMutation<{ total: number; updated: VideoGeneration[] }, Error, void>({
        mutationFn: () =>
            consoleHttpClient.post<{ total: number; updated: VideoGeneration[] }>(
                "/generation/batch/stale",
                {},
            ),
        ...options,
    });
}
