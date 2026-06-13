import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { SaveVideoPolicyParams, VideoPolicyConfig } from "../types/generation";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleVideoPoliciesQuery(options?: QueryOptionsUtil<VideoPolicyConfig[]>) {
    return useQuery<VideoPolicyConfig[]>({
        ...queryDefaults,
        queryKey: ["echoflow-video", "console", "policies"],
        queryFn: () => consoleHttpClient.get<VideoPolicyConfig[]>("/policies"),
        ...options,
    });
}

export function useUpsertGlobalVideoPolicyMutation(options?: MutationOptionsUtil<VideoPolicyConfig, SaveVideoPolicyParams>) {
    return useMutation<VideoPolicyConfig, Error, SaveVideoPolicyParams>({
        mutationFn: (data) => consoleHttpClient.put<VideoPolicyConfig>("/policies/global", data),
        ...options,
    });
}

export function useUpsertModelVideoPolicyMutation(
    options?: MutationOptionsUtil<VideoPolicyConfig, { modelConfigId: string; data: SaveVideoPolicyParams }>,
) {
    return useMutation<VideoPolicyConfig, Error, { modelConfigId: string; data: SaveVideoPolicyParams }>({
        mutationFn: ({ modelConfigId, data }) => consoleHttpClient.put<VideoPolicyConfig>(`/policies/model/${modelConfigId}`, data),
        ...options,
    });
}
