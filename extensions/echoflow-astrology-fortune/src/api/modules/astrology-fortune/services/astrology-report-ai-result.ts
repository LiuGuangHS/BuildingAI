import { safeJsonParse } from "@buildingai/extension-sdk/utils/pure";
import { z } from "zod";

import type { AstrologyReportResult } from "../../../db/entities";

const nonEmptyString = z.string().trim().min(1);
const allowedEvidenceSourceFragments = [
    "用户档案",
    "档案",
    "出生信息",
    "星座信息",
    "长期画像",
    "当前状态",
    "当前问题",
    "用户问题",
    "问题质量",
    "目标对象",
    "关系状态",
    "追问来源",
    "来源报告",
    "用户反馈",
    "反馈",
];
const unavailableEvidenceSourcePattern = /未提供|没有提供|未包含|缺失|无法确认|未知|猜测|推测|臆测|假设|虚构|编造/;
const deterministicPromisePattern = /必然|注定|保证|百分百|100%|一定会|绝对会|必定|肯定会|永远不会|必赚|稳赚|必胜/;
const computedChartClaimPattern = /月亮(?:落在|位于)|上升(?:点)?(?:位于|落在)|月亮星座(?:是|为)|上升星座(?:是|为)|宫位|相位|天体位置/;
const requiredSectionGroups = [
    { label: "洞察", test: /洞察|分析|判断/ },
    { label: "机会", test: /机会|优势|可借力|突破/ },
    { label: "风险", test: /风险|提醒|避开|注意/ },
    { label: "行动", test: /行动|建议|下一步|落地/ },
];
const reviewChecklistItemSchema = z.object({
    item: nonEmptyString,
    why: nonEmptyString,
    evidenceSource: nonEmptyString,
    timebox: z.string().trim().optional(),
});
const actionItemSchema = z.object({
    item: nonEmptyString,
    reason: nonEmptyString,
    timebox: nonEmptyString,
});
const warningItemSchema = z.object({
    title: nonEmptyString,
    detail: nonEmptyString,
});

export const astrologyReportAiResultSchema = z.object({
    title: nonEmptyString,
    summary: nonEmptyString,
    scores: z.record(z.string(), z.number().min(0).max(100)).refine((value) => typeof value.overall === "number", {
        message: "scores 必须包含 overall",
    }),
    keywords: z.array(nonEmptyString).min(2),
    lucky: z.object({
        color: nonEmptyString,
        number: z.number().int().min(0).max(99),
        direction: nonEmptyString,
        timeRange: nonEmptyString,
    }),
    evidence: z.array(z.object({
        source: nonEmptyString,
        insight: nonEmptyString,
        confidence: z.enum(["low", "medium", "high"]),
    })).min(2),
    sections: z.array(z.object({ heading: nonEmptyString, content: nonEmptyString })).min(4),
    actions: z.array(actionItemSchema).min(3),
    warnings: z.array(warningItemSchema).min(2),
    reviewChecklist: z.array(reviewChecklistItemSchema).min(2),
    followUps: z.array(nonEmptyString).min(2),
    closing: z.string().optional(),
}).superRefine((result, context) => {
    const traceableSources = new Set<string>();
    const evidenceAnchors = new Set<string>();

    for (const item of result.evidence) {
        addTraceableFragments(traceableSources, item.source);
        addTraceableFragments(traceableSources, item.insight);
        addEvidenceAnchors(evidenceAnchors, item.source, item.insight);
    }
    for (const item of result.actions ?? []) {
        addTraceableFragments(traceableSources, item.item);
        addTraceableFragments(traceableSources, item.reason);
        addTraceableFragments(traceableSources, item.timebox);
    }
    for (const item of result.warnings ?? []) {
        addTraceableFragments(traceableSources, item.title);
        addTraceableFragments(traceableSources, item.detail);
    }

    result.reviewChecklist.forEach((item, index) => {
        if (canTraceChecklistSource(item.evidenceSource, traceableSources)) return;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "复盘清单依据必须能对应本次报告的判断依据、行动建议或风险提醒",
            path: ["reviewChecklist", index, "evidenceSource"],
        });
    });

    result.followUps.forEach((item, index) => {
        if (isActionableFollowUp(item)) return;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "继续追问必须是可执行的问题或延展请求",
            path: ["followUps", index],
        });
    });

    result.evidence.forEach((item, index) => {
        if (isAllowedEvidenceSource(item.source)) return;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "判断依据来源必须来自用户档案、当前状态、问题、目标对象或追问来源等真实上下文",
            path: ["evidence", index, "source"],
        });
    });

    result.actions.forEach((item, index) => {
        if (canTraceToEvidence(`${item.item} ${item.reason}`, evidenceAnchors)) return;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "行动建议必须能回到本次报告的判断依据，避免脱离上下文的泛化建议",
            path: ["actions", index, "reason"],
        });
    });

    result.warnings.forEach((item, index) => {
        if (canTraceToEvidence(`${item.title} ${item.detail}`, evidenceAnchors)) return;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "风险提醒必须能回到本次报告的判断依据，避免凭空制造风险",
            path: ["warnings", index, "detail"],
        });
    });

    const sectionHeadings = result.sections.map((item) => item.heading).join(" ");
    for (const group of requiredSectionGroups) {
        if (group.test.test(sectionHeadings)) continue;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `报告段落必须覆盖${group.label}`,
            path: ["sections"],
        });
    }

    rejectDeterministicPromise(context, result.title, ["title"]);
    rejectDeterministicPromise(context, result.summary, ["summary"]);
    result.evidence.forEach((item, index) => {
        rejectDeterministicPromise(context, item.insight, ["evidence", index, "insight"]);
    });
    result.sections.forEach((item, index) => {
        rejectDeterministicPromise(context, `${item.heading} ${item.content}`, ["sections", index, "content"]);
    });
    result.actions.forEach((item, index) => {
        rejectDeterministicPromise(context, `${item.item} ${item.reason}`, ["actions", index, "item"]);
    });
    result.warnings.forEach((item, index) => {
        rejectDeterministicPromise(context, `${item.title} ${item.detail}`, ["warnings", index, "detail"]);
    });
    result.reviewChecklist.forEach((item, index) => {
        rejectDeterministicPromise(context, `${item.item} ${item.why}`, ["reviewChecklist", index, "item"]);
    });
    result.followUps.forEach((item, index) => {
        rejectDeterministicPromise(context, item, ["followUps", index]);
    });
    if (result.closing) rejectDeterministicPromise(context, result.closing, ["closing"]);

    rejectComputedChartClaims(context, result);
});

export type AstrologyReportAiResult = z.infer<typeof astrologyReportAiResultSchema>;

export function parseAstrologyReportAiResult(result: unknown): AstrologyReportAiResult {
    const payload = extractAstrologyReportModelPayload(result);
    const parsed = astrologyReportAiResultSchema.safeParse(payload);
    if (parsed.success) return parsed.data;
    throw new Error(`AI星盘报告结构解析失败: ${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")}`);
}

export function normalizeAstrologyReportAiResult(result: AstrologyReportAiResult): AstrologyReportResult {
    return {
        title: result.title?.trim() || "AI星盘运势报告",
        summary: result.summary?.trim() || "本次报告已生成，请结合现实情况理性参考。",
        scores: result.scores,
        keywords: (result.keywords ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 8),
        lucky: result.lucky ?? {},
        evidence: (result.evidence ?? [])
            .map((item) => ({
                source: item.source.trim(),
                insight: item.insight.trim(),
                ...(item.confidence ? { confidence: item.confidence } : {}),
            }))
            .filter((item) => item.source && item.insight)
            .slice(0, 5),
        sections: (result.sections ?? []).map((item) => ({ heading: item.heading.trim(), content: item.content.trim() })).filter((item) => item.heading && item.content).slice(0, 8),
        actions: (result.actions ?? [])
            .map((item) => ({
                item: item.item.trim(),
                reason: item.reason.trim(),
                timebox: item.timebox.trim(),
            }))
            .filter((item) => item.item && item.reason && item.timebox)
            .slice(0, 6),
        warnings: (result.warnings ?? [])
            .map((item) => ({
                title: item.title.trim(),
                detail: item.detail.trim(),
            }))
            .filter((item) => item.title && item.detail)
            .slice(0, 6),
        reviewChecklist: (result.reviewChecklist ?? [])
            .map((item) => ({
                item: item.item.trim(),
                why: item.why.trim(),
                evidenceSource: item.evidenceSource.trim(),
                ...(item.timebox?.trim() ? { timebox: item.timebox.trim() } : {}),
            }))
            .filter((item) => item.item && item.why && item.evidenceSource)
            .slice(0, 4),
        followUps: (result.followUps ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 4),
        closing: result.closing?.trim() || "把直觉当作提示，把行动交给自己。",
    };
}

function extractAstrologyReportModelPayload(result: unknown) {
    const maybeResult = result as {
        output?: unknown;
        text?: unknown;
        outputText?: unknown;
        output_text?: unknown;
        choices?: Array<{ message?: { content?: unknown } }>;
    };
    if (maybeResult?.output && typeof maybeResult.output === "object") return maybeResult.output;
    const text = firstTextValue([
        maybeResult?.text,
        maybeResult?.outputText,
        maybeResult?.output_text,
        maybeResult?.choices?.[0]?.message?.content,
        typeof result === "string" ? result : "",
    ]);
    const normalizedText = text.trim();
    if (!normalizedText) throw new Error("AI星盘报告为空，请稍后重试");
    const parsed = safeJsonParse<unknown>(stripJsonFence(normalizedText));
    if (parsed === undefined) throw new SyntaxError("AI星盘报告不是有效 JSON");
    return parsed;
}

function firstTextValue(values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value;
    }
    return "";
}

function stripJsonFence(text: string) {
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) return fenced[1].trim();
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1);
    return text;
}

function canTraceChecklistSource(evidenceSource: string, traceableSources: Set<string>) {
    const normalizedSource = normalizeTraceText(evidenceSource);
    if (!normalizedSource) return false;
    for (const candidate of traceableSources) {
        if (candidate === normalizedSource) return true;
        if (candidate.includes(normalizedSource) || normalizedSource.includes(candidate)) return true;
    }
    return false;
}

function addTraceableFragments(target: Set<string>, value: string) {
    const normalized = normalizeTraceText(value);
    if (normalized) target.add(normalized);
}

function normalizeTraceText(value: string) {
    return value.replace(/\s+/g, "").trim();
}

function addEvidenceAnchors(target: Set<string>, ...values: string[]) {
    for (const value of values) {
        for (const token of tokenizeEvidenceText(value)) {
            target.add(token);
        }
    }
}

function tokenizeEvidenceText(value: string) {
    const normalized = normalizeTraceText(value);
    const tokens = new Set<string>();
    for (const token of normalized.split(/[，。；、,.!?！？:：]/).map((item) => item.trim()).filter(Boolean)) {
        if (token.length >= 2) tokens.add(token);
        for (const fragment of buildCjkNgrams(token)) {
            tokens.add(fragment);
        }
    }
    for (const match of normalized.matchAll(/[\p{Script=Han}A-Za-z0-9]{2,}/gu)) {
        tokens.add(match[0]);
        for (const fragment of buildCjkNgrams(match[0])) {
            tokens.add(fragment);
        }
    }
    return Array.from(tokens).filter((token) => !isWeakEvidenceAnchor(token));
}

function isWeakEvidenceAnchor(token: string) {
    return token.length < 2 || /^(用户|当前|问题|状态|档案|信息|关系|目标|对象|来源|报告|说明|需要)$/.test(token);
}

function buildCjkNgrams(value: string) {
    if (!/^\p{Script=Han}+$/u.test(value) || value.length < 4) return [];
    const fragments = new Set<string>();
    for (const size of [2, 3, 4]) {
        for (let index = 0; index <= value.length - size; index += 1) {
            fragments.add(value.slice(index, index + size));
        }
    }
    return Array.from(fragments);
}

function canTraceToEvidence(value: string, evidenceAnchors: Set<string>) {
    const normalized = normalizeTraceText(value);
    if (!normalized) return false;
    for (const token of evidenceAnchors) {
        if (normalized.includes(token) || token.includes(normalized)) return true;
    }
    return false;
}

function isActionableFollowUp(value: string) {
    return /[？?]|如何|怎么|哪些|什么|是否|要不要|适合|应该|可以|帮我|把这份|拆成|改成|继续分析|重点看/.test(value);
}

function isAllowedEvidenceSource(value: string) {
    const normalized = normalizeTraceText(value);
    if (unavailableEvidenceSourcePattern.test(normalized)) return false;
    return allowedEvidenceSourceFragments.some((source) => normalized.includes(normalizeTraceText(source)));
}

function rejectComputedChartClaims(context: z.RefinementCtx, result: AstrologyReportAiResult) {
    const fields: Array<[string, Array<string | number>]> = [
        [result.title, ["title"]],
        [result.summary, ["summary"]],
        ...result.evidence.map((item, index) => [item.insight, ["evidence", index, "insight"]] as [string, Array<string | number>]),
        ...result.sections.map((item, index) => [`${item.heading} ${item.content}`, ["sections", index, "content"]] as [string, Array<string | number>]),
        ...result.actions.map((item, index) => [`${item.item} ${item.reason}`, ["actions", index, "reason"]] as [string, Array<string | number>]),
        ...result.warnings.map((item, index) => [`${item.title} ${item.detail}`, ["warnings", index, "detail"]] as [string, Array<string | number>]),
        ...result.reviewChecklist.map((item, index) => [`${item.item} ${item.why}`, ["reviewChecklist", index, "why"]] as [string, Array<string | number>]),
        ...result.followUps.map((item, index) => [item, ["followUps", index]] as [string, Array<string | number>]),
        ...(result.closing ? [[result.closing, ["closing"]] as [string, Array<string | number>]] : []),
    ];
    for (const [text, path] of fields) {
        if (!computedChartClaimPattern.test(normalizeTraceText(text))) continue;
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "月亮星座和上升星座只能作为用户补充信息，不能写成系统计算的星盘事实",
            path,
        });
    }
}

function rejectDeterministicPromise(context: z.RefinementCtx, value: string, path: Array<string | number>) {
    if (!deterministicPromisePattern.test(normalizeTraceText(value))) return;
    context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AI星盘报告不能使用必然、保证、注定等确定性承诺",
        path,
    });
}
