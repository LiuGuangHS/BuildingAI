import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OperationResult } from "../types/common";
import type { ImagePromptTemplate, SaveTemplateParams } from "../types/template";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleTemplatesQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; category?: string; enabled?: boolean },
    options?: PaginatedQueryOptionsUtil<ImagePromptTemplate>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "console", "templates", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<ImagePromptTemplate>>("/templates", { params }),
        ...options,
    });
}

export function useCreateTemplateMutation(options?: MutationOptionsUtil<ImagePromptTemplate, SaveTemplateParams>) {
    return useMutation<ImagePromptTemplate, Error, SaveTemplateParams>({
        mutationFn: (data) => consoleHttpClient.post<ImagePromptTemplate>("/templates", data),
        ...options,
    });
}

export function useUpdateTemplateMutation(
    options?: MutationOptionsUtil<ImagePromptTemplate, { id: string; data: SaveTemplateParams }>,
) {
    return useMutation<ImagePromptTemplate, Error, { id: string; data: SaveTemplateParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<ImagePromptTemplate>(`/templates/${id}`, data),
        ...options,
    });
}

export function useDeleteTemplateMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/templates/${id}`),
        ...options,
    });
}
