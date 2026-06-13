import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OperationResult, SaveVideoTemplateParams, VideoPromptTemplate } from "../types/generation";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleVideoTemplatesQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; category?: string; enabled?: boolean },
    options?: PaginatedQueryOptionsUtil<VideoPromptTemplate>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-video", "console", "templates", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<VideoPromptTemplate>>("/templates", { params }),
        ...options,
    });
}

export function useCreateVideoTemplateMutation(options?: MutationOptionsUtil<VideoPromptTemplate, SaveVideoTemplateParams>) {
    return useMutation<VideoPromptTemplate, Error, SaveVideoTemplateParams>({
        mutationFn: (data) => consoleHttpClient.post<VideoPromptTemplate>("/templates", data),
        ...options,
    });
}

export function useUpdateVideoTemplateMutation(
    options?: MutationOptionsUtil<VideoPromptTemplate, { id: string; data: SaveVideoTemplateParams }>,
) {
    return useMutation<VideoPromptTemplate, Error, { id: string; data: SaveVideoTemplateParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<VideoPromptTemplate>(`/templates/${id}`, data),
        ...options,
    });
}

export function useDeleteVideoTemplateMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/templates/${id}`),
        ...options,
    });
}
