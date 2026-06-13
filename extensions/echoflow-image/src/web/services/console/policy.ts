import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { ImagePolicyConfig, SavePolicyParams } from "../types/policy";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsolePoliciesQuery(options?: QueryOptionsUtil<ImagePolicyConfig[]>) {
    return useQuery<ImagePolicyConfig[]>({
        ...queryDefaults,
        queryKey: ["echoflow-image", "console", "policies"],
        queryFn: () => consoleHttpClient.get<ImagePolicyConfig[]>("/policies"),
        ...options,
    });
}

export function useUpsertGlobalPolicyMutation(options?: MutationOptionsUtil<ImagePolicyConfig, SavePolicyParams>) {
    return useMutation<ImagePolicyConfig, Error, SavePolicyParams>({
        mutationFn: (data) => consoleHttpClient.put<ImagePolicyConfig>("/policies/global", data),
        ...options,
    });
}

export function useUpsertModelPolicyMutation(
    options?: MutationOptionsUtil<ImagePolicyConfig, { modelConfigId: string; data: SavePolicyParams }>,
) {
    return useMutation<ImagePolicyConfig, Error, { modelConfigId: string; data: SavePolicyParams }>({
        mutationFn: ({ modelConfigId, data }) => consoleHttpClient.put<ImagePolicyConfig>(`/policies/model/${modelConfigId}`, data),
        ...options,
    });
}
