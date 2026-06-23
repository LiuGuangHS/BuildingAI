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
    result?: {
        summary?: string | null;
        scores?: Record<string, unknown> | null;
        keywords?: unknown[];
        lucky?: {
            color?: unknown;
            number?: unknown;
            direction?: unknown;
            timeRange?: unknown;
        } | null;
        evidence?: Array<{
            source?: unknown;
            insight?: unknown;
            confidence?: unknown;
        }>;
        reviewChecklist?: Array<{
            item?: unknown;
            why?: unknown;
            evidenceSource?: unknown;
            timebox?: unknown;
        }>;
        followUps?: unknown[];
    } | null;
    providerMetadata?: Record<string, unknown> | null;
};

type NotificationLuckyLike = {
    color?: unknown;
    number?: unknown;
    direction?: unknown;
    timeRange?: unknown;
} | null | undefined;

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
            ...buildSuccessfulReportNotificationAiData(report.result),
        },
    };
}

export function buildAstrologyReportFailedNotification(report: NotificationReportLike, message: string) {
    return {
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

function buildSuccessfulReportNotificationAiData(result: NotificationReportLike["result"]) {
    if (!result) return {};
    const summary = truncateText(result.summary, 160);
    const scores = normalizeScores(result.scores);
    const keywords = (result.keywords ?? []).map((item) => stringValue(item)).filter(Boolean).slice(0, 3);
    const lucky = normalizeLucky(result.lucky);
    const evidence = (result.evidence ?? [])
        .map((item) => {
            const source = stringValue(item.source);
            const insight = stringValue(item.insight);
            const confidence = normalizeEvidenceConfidence(item.confidence);
            if (!source || !insight || !confidence) return null;
            return {
                source,
                insight,
                confidence,
            };
        })
        .filter((item): item is { source: string; insight: string; confidence: "low" | "medium" | "high" } => Boolean(item))
        .slice(0, 2);
    const reviewChecklist = (result.reviewChecklist ?? [])
        .map((item) => {
            const checklistItem = stringValue(item.item);
            const why = stringValue(item.why);
            const evidenceSource = stringValue(item.evidenceSource);
            const timebox = stringValue(item.timebox);
            if (!checklistItem || !why || !evidenceSource) return null;
            return {
                item: checklistItem,
                why,
                evidenceSource,
                ...(timebox ? { timebox } : {}),
            };
        })
        .filter((item): item is { item: string; why: string; evidenceSource: string; timebox?: string } => Boolean(item))
        .slice(0, 2);
    const followUps = (result.followUps ?? []).map((item) => stringValue(item)).filter(Boolean).slice(0, 2);

    return {
        ...(summary ? { summary } : {}),
        ...(Object.keys(scores).length ? { scores } : {}),
        ...(keywords.length ? { keywords } : {}),
        ...(lucky ? { lucky } : {}),
        ...(evidence.length ? { evidence } : {}),
        ...(reviewChecklist.length ? { reviewChecklist } : {}),
        ...(followUps.length ? { followUps } : {}),
    };
}

function normalizeEvidenceConfidence(value: unknown): "low" | "medium" | "high" | null {
    return value === "low" || value === "medium" || value === "high" ? value : null;
}

function normalizeScores(scores: Record<string, unknown> | null | undefined) {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores ?? {})) {
        if (typeof value === "number" && Number.isFinite(value)) {
            normalized[key] = Math.max(0, Math.min(100, Math.round(value)));
        }
    }
    return normalized;
}

function normalizeLucky(lucky: NotificationLuckyLike) {
    if (!lucky || typeof lucky !== "object") return null;
    const color = stringValue(lucky.color);
    const direction = stringValue(lucky.direction);
    const timeRange = stringValue(lucky.timeRange);
    const numberValue = typeof lucky.number === "number" && Number.isFinite(lucky.number) ? Math.round(lucky.number) : null;
    if (!color && !direction && !timeRange && numberValue === null) return null;
    return {
        ...(color ? { color } : {}),
        ...(numberValue !== null ? { number: numberValue } : {}),
        ...(direction ? { direction } : {}),
        ...(timeRange ? { timeRange } : {}),
    };
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function truncateText(value: unknown, limit: number) {
    const text = stringValue(value).replace(/\s+/g, " ");
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1)}…`;
}
