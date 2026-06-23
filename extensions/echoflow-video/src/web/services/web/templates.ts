import type { PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { VideoPromptTemplate } from "../types/generation";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

const emptyTemplatePage = (params?: { page?: number; pageSize?: number }): PaginatedResponse<VideoPromptTemplate> => ({
    items: [],
    total: 0,
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 10,
    totalPages: 0,
});

export function useWebVideoTemplatesQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; category?: string; abilityType?: string; modelConfigId?: string },
    options?: PaginatedQueryOptionsUtil<VideoPromptTemplate>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-video", "web", "templates", params],
        queryFn: async () => {
            try {
                return await apiHttpClient.get<PaginatedResponse<VideoPromptTemplate>>("/templates", { params, silent: true });
            } catch {
                return emptyTemplatePage(params);
            }
        },
        ...options,
    });
}
