export type AstrologyReportBillingSnapshot = {
    status: string;
    billingStatus?: string | null;
    hasDeductionLog: boolean;
    hasRefundLog?: boolean;
};

export function canTransitionAstrologyReportToFailed(status: string): boolean {
    return status === "pending" || status === "processing";
}

export function canRefundAstrologyReport(snapshot: AstrologyReportBillingSnapshot): boolean {
    return snapshot.status === "failed" &&
        snapshot.hasDeductionLog &&
        snapshot.billingStatus !== "refunded" &&
        !snapshot.hasRefundLog;
}

export function shouldNotifyAstrologyReport(snapshot: { status: string; notificationSentAt?: string | null }): boolean {
    return (snapshot.status === "success" || snapshot.status === "failed") && !snapshot.notificationSentAt;
}
