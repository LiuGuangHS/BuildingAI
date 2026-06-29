export const CONTRACT_TASK_RECOVERY_LOCK_MS = 5 * 60 * 1000;
export const CONTRACT_TASK_PROCESSING_LOCK_MS = 30 * 60 * 1000;
export const CONTRACT_TASK_RECOVERABLE_JOB = {
    GENERATE: "generate_contract",
    REVIEW_UPLOAD: "review_upload",
} as const;
export const CONTRACT_TASK_BUSY_STATUSES = [
    "pending",
    "processing",
    "reviewing",
    "exporting",
] as const;
export const CONTRACT_TASK_RECOVERABLE_STATUSES = [
    "pending",
    "processing",
] as const;

export function isContractTaskBusyStatus(status: string) {
    return (CONTRACT_TASK_BUSY_STATUSES as readonly string[]).includes(status);
}

function isContractTaskRecoverableStatus(status: string) {
    return (CONTRACT_TASK_RECOVERABLE_STATUSES as readonly string[]).includes(status);
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
    if (!isContractTaskRecoverableStatus(task.status)) return false;
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
    if (!isContractTaskRecoverableStatus(task.status)) return false;
    if (task.status !== "processing") return true;
    const lockedAtMs = typeof task.providerMetadata?.processingLockedAt === "string"
        ? Date.parse(task.providerMetadata.processingLockedAt)
        : 0;
    return !(lockedAtMs && nowMs - lockedAtMs < CONTRACT_TASK_PROCESSING_LOCK_MS);
}

export function resolveStaleContractTaskResolution(status: string) {
    if (status === "reviewing") {
        return { status: "draft", errorKey: "lastReviewError", message: "合同审查任务超时，请重新发起审查" };
    }
    if (status === "exporting") {
        return { status: "export_failed", errorKey: "lastExportError", message: "合同导出任务超时，请重新导出" };
    }
    if (isContractTaskRecoverableStatus(status)) {
        return { status: "failed", errorKey: "timeoutError", message: "合同生成任务超时，请重新提交" };
    }
    return null;
}
