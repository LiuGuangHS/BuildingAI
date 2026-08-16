import { createHash } from "node:crypto";

export type ImageBillingState = {
    billingStatus: string;
    hasDeductionLog: boolean;
    hasRefundLog?: boolean;
    refundRequired?: boolean;
};

export type ImageRetrySource = {
    id: string;
    prompt: string;
    negativePrompt?: string;
    referenceImageUrl?: string;
    referenceImageFileId?: string;
    sourceImages?: unknown[];
    maskImageUrl?: string;
    maskImageFileId?: string;
    modelId: string;
    size: string;
    n: number;
    quality?: string;
    style?: string;
    responseFormat: string;
    mode: string;
    outputFormat?: string;
    background?: string;
    outputCompression?: number;
    inputFidelity?: string;
    moderation?: string;
    seed?: string;
};

export function canReserveImageGeneration(activeCount: number, maxConcurrentJobsPerUser: number): boolean {
    return activeCount < maxConcurrentJobsPerUser;
}

export function hasImageGenerationRequestKey(value: unknown): value is string {
    return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function shouldReturnExistingImageGeneration(
    record: { userId: string; requestKey?: string | null } | null | undefined,
    userId: string,
    requestKey: string,
): boolean {
    return Boolean(record && record.userId === userId && record.requestKey === requestKey);
}

export function shouldDeductImageGeneration(state: ImageBillingState): boolean {
    return state.billingStatus === "pending" && !state.hasDeductionLog;
}

export function shouldRefundImageGeneration(state: ImageBillingState): boolean {
    return state.hasDeductionLog && state.billingStatus !== "refunded" && !state.hasRefundLog;
}

export function shouldRecoverImageRefund(state: Pick<ImageBillingState, "billingStatus" | "refundRequired">): boolean {
    return state.billingStatus === "deducted" && state.refundRequired === true;
}

export function resolveImageFailureBilling(input: {
    billingStatus: string;
    billingAmount: number;
    refundAllowed: boolean;
}): { billingStatus: string; refundRequired: boolean } {
    if (input.billingAmount <= 0) {
        return { billingStatus: "failed", refundRequired: false };
    }
    return {
        billingStatus: input.billingStatus,
        refundRequired: input.refundAllowed && input.billingStatus === "deducted",
    };
}

export function isImageRefundFailureTimestamp(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function resolveImageRefundFailure(state: Pick<ImageBillingState, "billingStatus"> & { refundError?: string }): {
    billingStatus: string;
    recoverable: boolean;
} {
    return {
        billingStatus: state.billingStatus,
        recoverable: state.billingStatus === "deducted" && Boolean(state.refundError),
    };
}

export function deriveImageRetryRequestKey(generationId: string): string {
    const digest = createHash("sha256")
        .update(`echoflow-image:retry:${generationId}`)
        .digest("hex");
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function buildImageRetryPayload(source: ImageRetrySource, requestKey: string): Record<string, unknown> {
    return {
        prompt: source.prompt,
        ...(source.negativePrompt ? { negativePrompt: source.negativePrompt } : {}),
        ...(source.referenceImageUrl ? { referenceImageUrl: source.referenceImageUrl } : {}),
        ...(source.referenceImageFileId ? { referenceImageFileId: source.referenceImageFileId } : {}),
        ...(source.sourceImages?.length ? { sourceImages: source.sourceImages } : {}),
        ...(source.maskImageUrl ? { maskImageUrl: source.maskImageUrl } : {}),
        ...(source.maskImageFileId ? { maskImageFileId: source.maskImageFileId } : {}),
        modelId: source.modelId,
        size: source.size,
        n: source.n,
        ...(source.quality ? { quality: source.quality } : {}),
        ...(source.style ? { style: source.style } : {}),
        responseFormat: source.responseFormat,
        mode: source.mode,
        ...(source.outputFormat ? { outputFormat: source.outputFormat } : {}),
        ...(source.background ? { background: source.background } : {}),
        ...(source.outputCompression !== undefined ? { outputCompression: source.outputCompression } : {}),
        ...(source.inputFidelity ? { inputFidelity: source.inputFidelity } : {}),
        ...(source.moderation ? { moderation: source.moderation } : {}),
        ...(source.seed ? { seed: source.seed } : {}),
        requestKey,
    };
}

export function imageGenerationConsumesReservation(status: string): boolean {
    return status === "pending" || status === "processing";
}
