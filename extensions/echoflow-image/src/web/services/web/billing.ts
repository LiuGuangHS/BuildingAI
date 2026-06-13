import type { MutationOptionsUtil } from "@buildingai/web-types";
import { useMutation } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { BillingEstimate, EstimateBillingParams } from "../types/billing";

export function useWebEstimateBillingMutation(options?: MutationOptionsUtil<BillingEstimate, EstimateBillingParams>) {
    return useMutation<BillingEstimate, Error, EstimateBillingParams>({
        mutationFn: (data) => apiHttpClient.post<BillingEstimate>("/billing/estimate", data),
        ...options,
    });
}
