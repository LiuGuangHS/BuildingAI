export const CONTRACT_TASK_RECOVERY_LOCK_MS = 5 * 60 * 1000;
export const CONTRACT_TASK_RECOVERABLE_JOB = {
    GENERATE: "generate_contract",
    REVIEW_UPLOAD: "review_upload",
} as const;
export const CONTRACT_TASK_BUSY_STATUSES = [
    "pending",
    "processing",
] as const;

export function isContractTaskBusyStatus(status: string) {
    return (CONTRACT_TASK_BUSY_STATUSES as readonly string[]).includes(status);
}

export type ContractTaskRecoverySnapshot = {
    status: string;
    deletedAt?: Date | string | null;
    updatedAt?: Date;
    requestPayload?: unknown;
    providerMetadata?: {
        jobType?: unknown;
        recoveryLockedAt?: unknown;
        processingLockedAt?: unknown;
    } | null;
};

export function resolveContractTaskJobName(task: Pick<ContractTaskRecoverySnapshot, "providerMetadata">) {
    const jobType = task.providerMetadata?.jobType;
    if (jobType === CONTRACT_TASK_RECOVERABLE_JOB.GENERATE || jobType === CONTRACT_TASK_RECOVERABLE_JOB.REVIEW_UPLOAD) {
        return jobType;
    }
    return null;
}

export function isContractTaskRecoveryLockActive(
    lockedAt: unknown,
    nowMs = Date.now(),
    lockMs = CONTRACT_TASK_RECOVERY_LOCK_MS,
) {
    const lockedAtMs = typeof lockedAt === "string" ? Date.parse(lockedAt) : 0;
    return Boolean(lockedAtMs && nowMs - lockedAtMs < lockMs);
}

export function canRecoverContractTask<T extends ContractTaskRecoverySnapshot>(
    task: T | null | undefined,
    cutoff: Date,
    nowMs = Date.now(),
): task is T & { requestPayload: NonNullable<T["requestPayload"]> } {
    if (!task || task.deletedAt) return false;
    if (!isContractTaskBusyStatus(task.status)) return false;
    if (!task.requestPayload) return false;
    if (task.updatedAt && task.updatedAt > cutoff) return false;
    if (!resolveContractTaskJobName(task)) return false;
    return !isContractTaskRecoveryLockActive(task.providerMetadata?.recoveryLockedAt, nowMs);
}

export function canClaimContractTaskForProcessing<T extends ContractTaskRecoverySnapshot>(
    task: T | null | undefined,
    nowMs = Date.now(),
): task is T {
    if (!task || task.deletedAt) return false;
    if (!isContractTaskBusyStatus(task.status)) return false;
    if (task.status !== "processing") return true;
    return !isContractTaskRecoveryLockActive(task.providerMetadata?.processingLockedAt, nowMs);
}
