const ASTROLOGY_REQUEST_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AstrologyRequestKeyReport = {
    userId: string;
    requestKey?: string | null;
};

export function hasAstrologyReportRequestKey(value: unknown): value is string {
    return typeof value === "string" && value.length === 36 && ASTROLOGY_REQUEST_KEY_PATTERN.test(value);
}

export function shouldReturnExistingAstrologyReport(
    report: AstrologyRequestKeyReport | null | undefined,
    userId: string,
    requestKey: string,
): boolean {
    return Boolean(report && report.userId === userId && report.requestKey === requestKey);
}

export function isAstrologyReportRequestKeyUniqueConstraint(error: unknown): boolean {
    const databaseError = error as { code?: unknown; constraint?: unknown; message?: unknown } | null;
    return databaseError?.code === "23505" ||
        databaseError?.constraint === "uq_astrology_reports_user_request_key" ||
        (typeof databaseError?.message === "string" && databaseError.message.includes("uq_astrology_reports_user_request_key"));
}
