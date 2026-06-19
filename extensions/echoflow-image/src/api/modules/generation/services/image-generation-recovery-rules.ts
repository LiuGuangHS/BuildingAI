export const IMAGE_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;
export const IMAGE_PENDING_RESUME_AFTER_MS = 2 * 60 * 1000;
export const IMAGE_RESUMED_PROGRESS_MAX = 10;

export type ImageGenerationRecoverySnapshot = {
    status: string;
    updatedAt?: Date;
    deletedAt?: Date | string | null;
    progress?: number | null;
};

export function isImageGenerationTerminalStatus(status: string) {
    return status === "succeeded" || status === "failed";
}

export function shouldTimeoutImageGeneration(
    generation: ImageGenerationRecoverySnapshot | null | undefined,
    nowMs = Date.now(),
) {
    if (!generation || generation.deletedAt) return false;
    if (generation.status !== "processing") return false;
    if (!generation.updatedAt) return false;
    return generation.updatedAt.getTime() <= nowMs - IMAGE_PROCESSING_TIMEOUT_MS;
}

export function shouldResumeImageGeneration(
    generation: ImageGenerationRecoverySnapshot | null | undefined,
    nowMs = Date.now(),
) {
    if (!generation || generation.deletedAt) return false;
    if (generation.status !== "pending") return false;
    if (!generation.updatedAt) return false;
    return generation.updatedAt.getTime() <= nowMs - IMAGE_PENDING_RESUME_AFTER_MS;
}

export function getResumedImageProgress(progress?: number | null) {
    return Math.min(progress ?? 0, IMAGE_RESUMED_PROGRESS_MAX);
}
