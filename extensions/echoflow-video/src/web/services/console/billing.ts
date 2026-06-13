import type { MutationOptionsUtil, PaginatedQueryOptionsUtil, PaginatedResponse } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type {
    BillingEstimate,
    EstimateVideoBillingParams,
    OperationResult,
    SaveVideoBillingRuleParams,
    VideoBillingRule,
} from "../types/generation";

const queryDefaults = { retry: false, staleTime: 30_000 } as const;

export function useConsoleVideoBillingRulesQuery(
    params?: { page?: number; pageSize?: number; modelConfigId?: string },
    options?: PaginatedQueryOptionsUtil<VideoBillingRule>,
) {
    return useQuery({
        ...queryDefaults,
        queryKey: ["echoflow-video", "console", "billing-rules", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<VideoBillingRule>>("/billing-rules", { params }),
        ...options,
    });
}

export function useCreateVideoBillingRuleMutation(options?: MutationOptionsUtil<VideoBillingRule, SaveVideoBillingRuleParams>) {
    return useMutation<VideoBillingRule, Error, SaveVideoBillingRuleParams>({
        mutationFn: (data) => consoleHttpClient.post<VideoBillingRule>("/billing-rules", data),
        ...options,
    });
}

export function useUpdateVideoBillingRuleMutation(
    options?: MutationOptionsUtil<VideoBillingRule, { id: string; data: SaveVideoBillingRuleParams }>,
) {
    return useMutation<VideoBillingRule, Error, { id: string; data: SaveVideoBillingRuleParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.put<VideoBillingRule>(`/billing-rules/${id}`, data),
        ...options,
    });
}

export function useDeleteVideoBillingRuleMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/billing-rules/${id}`),
        ...options,
    });
}

export function useConsoleEstimateVideoBillingMutation(options?: MutationOptionsUtil<BillingEstimate, EstimateVideoBillingParams>) {
    return useMutation<BillingEstimate, Error, EstimateVideoBillingParams>({
        mutationFn: (data) => consoleHttpClient.post<BillingEstimate>("/billing-rules/estimate", data),
        ...options,
    });
}
