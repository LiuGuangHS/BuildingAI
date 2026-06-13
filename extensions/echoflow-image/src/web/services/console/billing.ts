import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OperationResult } from "../types/common";
import type { BillingEstimate, EstimateBillingParams, ImageBillingRule, SaveBillingRuleParams } from "../types/billing";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleBillingRulesQuery(
    params?: { page?: number; pageSize?: number; modelConfigId?: string },
    options?: PaginatedQueryOptionsUtil<ImageBillingRule>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-image", "console", "billing-rules", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<ImageBillingRule>>("/billing-rules", { params }),
        ...options,
    });
}

export function useCreateBillingRuleMutation(options?: MutationOptionsUtil<ImageBillingRule, SaveBillingRuleParams>) {
    return useMutation<ImageBillingRule, Error, SaveBillingRuleParams>({
        mutationFn: (data) => consoleHttpClient.post<ImageBillingRule>("/billing-rules", data),
        ...options,
    });
}

export function useUpdateBillingRuleMutation(
    options?: MutationOptionsUtil<ImageBillingRule, { id: string; data: SaveBillingRuleParams }>,
) {
    return useMutation<ImageBillingRule, Error, { id: string; data: SaveBillingRuleParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<ImageBillingRule>(`/billing-rules/${id}`, data),
        ...options,
    });
}

export function useDeleteBillingRuleMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/billing-rules/${id}`),
        ...options,
    });
}

export function useConsoleEstimateBillingMutation(options?: MutationOptionsUtil<BillingEstimate, EstimateBillingParams>) {
    return useMutation<BillingEstimate, Error, EstimateBillingParams>({
        mutationFn: (data) => consoleHttpClient.post<BillingEstimate>("/billing-rules/estimate", data),
        ...options,
    });
}
