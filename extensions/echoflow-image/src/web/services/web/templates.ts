import type { PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { ImagePromptTemplate } from "../types/template";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useWebTemplatesQuery(
    params?: { page?: number; pageSize?: number; keyword?: string; category?: string },
    options?: PaginatedQueryOptionsUtil<ImagePromptTemplate>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "web", "templates", params],
        queryFn: () => apiHttpClient.get<PaginatedResponse<ImagePromptTemplate>>("/templates", { params }),
        ...options,
    });
}
