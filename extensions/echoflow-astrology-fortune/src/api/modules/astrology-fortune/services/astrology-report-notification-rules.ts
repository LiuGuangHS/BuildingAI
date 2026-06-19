export const ASTROLOGY_FORTUNE_EXTENSION_ID = "echoflow-astrology-fortune";
export const ASTROLOGY_REPORT_LINK_URL = `/extension/${ASTROLOGY_FORTUNE_EXTENSION_ID}/`;
export const ASTROLOGY_REPORT_SUCCEEDED_SCENE = `${ASTROLOGY_FORTUNE_EXTENSION_ID}.report.succeeded`;
export const ASTROLOGY_REPORT_FAILED_SCENE = `${ASTROLOGY_FORTUNE_EXTENSION_ID}.report.failed`;

type NotificationReportLike = {
    id: string;
    userId: string;
    reportType: string;
    score?: number | null;
    tags?: string[] | null;
    providerMetadata?: Record<string, unknown> | null;
};

export function getAstrologyReportDisplayName(reportType: string) {
    const names: Record<string, string> = {
        daily: "每日运势报告",
        weekly: "每周运势报告",
        monthly: "每月运势报告",
        natal: "本命星盘报告",
        love: "情感运势报告",
        career: "事业运势报告",
        wealth: "财富运势报告",
        relationship: "关系洞察报告",
        compatibility: "关系合盘报告",
        decision: "决策辅助报告",
        profile: "长期画像报告",
        personality: "性格画像报告",
    };
    return names[reportType] || "星盘运势报告";
}

export function buildAstrologyReportSucceededNotification(report: NotificationReportLike) {
    return {
        extensionId: ASTROLOGY_FORTUNE_EXTENSION_ID,
        userId: report.userId,
        sceneCode: ASTROLOGY_REPORT_SUCCEEDED_SCENE,
        level: "success" as const,
        linkUrl: ASTROLOGY_REPORT_LINK_URL,
        sourceType: "report",
        sourceId: report.id,
        data: {
            taskName: getAstrologyReportDisplayName(report.reportType),
            reportType: report.reportType,
            score: report.score,
            tags: report.tags ?? [],
        },
    };
}

export function buildAstrologyReportFailedNotification(report: NotificationReportLike, message: string) {
    return {
        extensionId: ASTROLOGY_FORTUNE_EXTENSION_ID,
        userId: report.userId,
        sceneCode: ASTROLOGY_REPORT_FAILED_SCENE,
        level: "error" as const,
        linkUrl: ASTROLOGY_REPORT_LINK_URL,
        sourceType: "report",
        sourceId: report.id,
        data: {
            taskName: getAstrologyReportDisplayName(report.reportType),
            reportType: report.reportType,
            reason: message || "请稍后重试或联系管理员",
            billingStatus: report.providerMetadata?.billingStatus,
            refundedAt: report.providerMetadata?.refundedAt,
            refundError: report.providerMetadata?.refundError,
        },
    };
}
