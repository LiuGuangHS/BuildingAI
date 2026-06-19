export const ASTROLOGY_REPORT_STALE_PROCESSING_MS = 30 * 60 * 1000;
export const ASTROLOGY_REPORT_RECOVERY_LOCK_MS = 5 * 60 * 1000;

export const ASTROLOGY_REPORT_PENDING_STATUS = "pending";
export const ASTROLOGY_REPORT_PROCESSING_STATUS = "processing";
export const ASTROLOGY_REPORT_FAILED_STATUS = "failed";

export const ASTROLOGY_REPORT_BUSY_STATUSES = [
    ASTROLOGY_REPORT_PENDING_STATUS,
    ASTROLOGY_REPORT_PROCESSING_STATUS,
] as const;

type BusyAstrologyReportStatus = (typeof ASTROLOGY_REPORT_BUSY_STATUSES)[number];

type ReportLike = {
    status: string;
    updatedAt: Date;
    deletedAt?: Date | null;
    providerMetadata?: Record<string, unknown> | null;
    requestPayload?: Record<string, unknown> | null;
};

export function isAstrologyReportBusyStatus(status: string): status is BusyAstrologyReportStatus {
    return (ASTROLOGY_REPORT_BUSY_STATUSES as readonly string[]).includes(status);
}

export function isAstrologyReportRecoveryLockActive(
    metadata: Record<string, unknown> | null | undefined,
    nowMs: number,
    lockMs = ASTROLOGY_REPORT_RECOVERY_LOCK_MS,
) {
    const recoveryLockedAt = typeof metadata?.recoveryLockedAt === "string" ? Date.parse(metadata.recoveryLockedAt) : 0;
    return Boolean(recoveryLockedAt && nowMs - recoveryLockedAt < lockMs);
}

export function isAstrologyReportProcessingLockActive(
    metadata: Record<string, unknown> | null | undefined,
    nowMs: number,
    lockMs = ASTROLOGY_REPORT_RECOVERY_LOCK_MS,
) {
    const processingLockedAt = typeof metadata?.processingLockedAt === "string" ? Date.parse(metadata.processingLockedAt) : 0;
    return Boolean(processingLockedAt && nowMs - processingLockedAt < lockMs);
}

export function canRecoverAstrologyReport<T extends ReportLike>(
    report: T | null | undefined,
    cutoff: Date,
    nowMs: number,
): report is T & { requestPayload: NonNullable<T["requestPayload"]> } {
    if (!report || report.deletedAt) return false;
    if (!isAstrologyReportBusyStatus(report.status)) return false;
    if (!report.requestPayload) return false;
    if (report.updatedAt > cutoff) return false;
    return !isAstrologyReportRecoveryLockActive(report.providerMetadata, nowMs);
}

export function canClaimAstrologyReportForProcessing<T extends ReportLike>(
    report: T | null | undefined,
    nowMs: number,
): report is T {
    if (!report || report.deletedAt) return false;
    if (!isAstrologyReportBusyStatus(report.status)) return false;
    if (report.status !== ASTROLOGY_REPORT_PROCESSING_STATUS) return true;
    return !isAstrologyReportProcessingLockActive(report.providerMetadata, nowMs);
}
