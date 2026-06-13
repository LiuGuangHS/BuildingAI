import type { MutationOptionsUtil } from "@buildingai/web-types";
import { useMutation } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { BillingEstimate, EstimateVideoBillingParams } from "../types/generation";

export function useWebEstimateVideoBillingMutation(options?: MutationOptionsUtil<BillingEstimate, EstimateVideoBillingParams>) {
    return useMutation<BillingEstimate, Error, EstimateVideoBillingParams>({
        mutationFn: (data) => apiHttpClient.post<BillingEstimate>("/billing/estimate", data),
        ...options,
    });
}
