export const VIDEO_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;
export const VIDEO_PENDING_RESUME_AFTER_MS = 2 * 60 * 1000;
export const VIDEO_RESUMED_PROGRESS_MAX = 10;

export type VideoGenerationRecoverySnapshot = {
    status: string;
    billingStatus?: string;
    updatedAt?: Date;
    deletedAt?: Date | string | null;
    progress?: number | null;
    videoUrl?: string | null;
};

export function isVideoGenerationTerminalStatus(status: string): boolean {
    return status === "succeeded" || status === "failed";
}

export function canRetryVideoGeneration(status: string, billingStatus: string): boolean {
    return status === "failed" && (billingStatus === "failed" || billingStatus === "refunded");
}

export function canFailVideoGeneration(status: string): boolean {
    return status === "pending" || status === "processing";
}

export function canCompleteVideoGeneration(
    status: string,
    videoUrl?: string | null,
): boolean {
    return status === "processing" && Boolean(videoUrl);
}

export function shouldTimeoutVideoGeneration(
    generation: VideoGenerationRecoverySnapshot | null | undefined,
    nowMs = Date.now(),
): boolean {
    if (!generation || generation.deletedAt) return false;
    if (generation.status !== "processing" || !generation.updatedAt) return false;
    return generation.updatedAt.getTime() <= nowMs - VIDEO_PROCESSING_TIMEOUT_MS;
}

export function shouldResumeVideoGeneration(
    generation: VideoGenerationRecoverySnapshot | null | undefined,
    nowMs = Date.now(),
): boolean {
    if (!generation || generation.deletedAt) return false;
    if (generation.status !== "pending" || !generation.updatedAt) return false;
    return generation.updatedAt.getTime() <= nowMs - VIDEO_PENDING_RESUME_AFTER_MS;
}

export function getResumedVideoProgress(progress?: number | null): number {
    return Math.min(progress ?? 0, VIDEO_RESUMED_PROGRESS_MAX);
}