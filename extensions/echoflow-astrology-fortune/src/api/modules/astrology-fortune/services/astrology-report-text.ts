import type { AstrologyReportResult } from "../../../db/entities";

const CONFIDENCE_LABELS = {
    low: "低可信",
    medium: "中可信",
    high: "高可信",
} as const;

const SCORE_LABELS: Record<string, string> = {
    overall: "整体",
    love: "爱情",
    career: "事业",
    wealth: "财富",
    mood: "情绪",
    social: "人际",
};
type ReportActionItem = NonNullable<AstrologyReportResult["actions"]>[number];
type ReportWarningItem = NonNullable<AstrologyReportResult["warnings"]>[number];

export function buildAstrologyReportText(result: AstrologyReportResult) {
    const lines = [`# ${result.title}`, "", result.summary, ""];

    if (result.keywords?.length) {
        lines.push(`关键词：${result.keywords.join("、")}`, "");
    }

    const scores = Object.entries(result.scores ?? {});
    if (scores.length) {
        lines.push("## 评分");
        for (const [key, value] of scores) {
            lines.push(`- ${SCORE_LABELS[key] ?? key}：${Math.round(value)}%`);
        }
        lines.push("");
    }

    if (result.lucky) {
        const luckyLines = [
            result.lucky.color ? `- 幸运色：${result.lucky.color}` : "",
            typeof result.lucky.number === "number" ? `- 幸运数字：${result.lucky.number}` : "",
            result.lucky.direction ? `- 方位：${result.lucky.direction}` : "",
            result.lucky.timeRange ? `- 时间段：${result.lucky.timeRange}` : "",
        ].filter(Boolean);
        if (luckyLines.length) lines.push("## 幸运锚点", ...luckyLines, "");
    }

    if (result.evidence?.length) {
        lines.push("## 判断依据");
        for (const item of result.evidence) {
            const confidence = item.confidence ? `（${CONFIDENCE_LABELS[item.confidence]}）` : "";
            lines.push(`- ${item.source}${confidence}：${item.insight}`);
        }
        lines.push("");
    }

    for (const section of result.sections ?? []) {
        lines.push(`## ${section.heading}`, section.content, "");
    }

    if (result.actions?.length) {
        lines.push("## 行动建议", ...result.actions.map((item) => `- ${formatActionItem(item)}`), "");
    }

    if (result.warnings?.length) {
        lines.push("## 风险提醒", ...result.warnings.map((item) => `- ${formatWarningItem(item)}`), "");
    }

    if (result.reviewChecklist?.length) {
        lines.push("## 复盘清单");
        for (const item of result.reviewChecklist) {
            const timebox = item.timebox ? `[${item.timebox}] ` : "";
            lines.push(`- ${timebox}${item.item}`);
            lines.push(`  依据：${item.evidenceSource}；验证点：${item.why}`);
        }
        lines.push("");
    }

    if (result.followUps?.length) {
        lines.push("## 继续追问", ...result.followUps.map((item) => `- ${item}`), "");
    }

    lines.push(result.closing || "");
    return lines.join("\n").trim();
}

function formatActionItem(item: ReportActionItem) {
    if (typeof item === "string") return item;
    return [item.item, item.reason, item.timebox].filter(Boolean).join(" · ");
}

function formatWarningItem(item: ReportWarningItem) {
    if (typeof item === "string") return item;
    return [item.title, item.detail].filter(Boolean).join(" · ");
}
