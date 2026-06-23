import type { ContractGenerationStatus, ContractGenerationTask, ContractTemplate } from "../../services/types";

export type ContractWorkbenchMode = "draft" | "review";

export type ContractWorkbenchAction = {
    key: "configure" | "complete_facts" | "generate" | "upload_review" | "wait" | "save" | "review" | "export";
    label: string;
    tone: "primary" | "secondary" | "blocked";
};

export type ContractWorkbenchSignal = {
    label: string;
    value: string;
    tone: "neutral" | "good" | "warn" | "danger";
};

export type ContractWorkbenchFact = {
    key: string;
    label: string;
    value: string;
};

export type ContractWorkbenchState = {
    kicker: string;
    title: string;
    subtitle: string;
    recognizedFacts: ContractWorkbenchFact[];
    missingFacts: ContractWorkbenchFact[];
    aiSignals: ContractWorkbenchSignal[];
    primaryAction: ContractWorkbenchAction;
    billingNote: string;
};

export type ContractInspectorTab = {
    key: "risks" | "rewrite" | "versions" | "export";
    label: string;
    badge?: string;
};

const BUSY_STATUSES = new Set<ContractGenerationStatus>(["pending", "processing", "reviewing", "exporting"]);

export function deriveContractWorkbenchState(options: {
    mode: ContractWorkbenchMode;
    configured: boolean;
    template?: ContractTemplate;
    variables: Record<string, unknown>;
    prompt: string;
    reviewFileName?: string;
    task?: ContractGenerationTask | null;
    dirty: boolean;
}): ContractWorkbenchState {
    const recognizedFacts: ContractWorkbenchFact[] = [];
    const missingFacts: ContractWorkbenchFact[] = [];

    for (const field of options.template?.fields ?? []) {
        const value = String(options.variables[field.key] ?? "").trim();
        if (value) {
            recognizedFacts.push({ key: field.key, label: field.label, value });
        } else if (field.required) {
            missingFacts.push({ key: field.key, label: field.label, value: "待补充" });
        }
    }

    const prompt = options.prompt.trim();
    if (prompt) recognizedFacts.push({ key: "prompt", label: "补充要求", value: prompt });
    if (options.reviewFileName) recognizedFacts.push({ key: "file", label: "审查文件", value: options.reviewFileName });
    if (options.task?.summary) recognizedFacts.push({ key: "summary", label: "AI 摘要", value: options.task.summary });

    const riskFindings = options.task?.riskFindings ?? [];
    const highRiskCount = riskFindings.filter((risk) => risk.level === "high").length;
    const sectionCount = options.task?.sections?.length ?? 0;

    return {
        kicker: "AI 合同",
        title: options.task?.title || options.template?.name || (options.mode === "review" ? "上传合同审查" : "新合同起草"),
        subtitle: options.mode === "review" ? "上传文件后抽取条款、标注风险、生成改写建议。" : "先补合同事实，再生成可编辑条款和风险判断。",
        recognizedFacts,
        missingFacts,
        aiSignals: [
            { label: "已识别事实", value: String(recognizedFacts.length), tone: recognizedFacts.length ? "good" : "neutral" },
            { label: "缺失事实", value: String(missingFacts.length), tone: missingFacts.length ? "warn" : "good" },
            { label: "条款", value: sectionCount ? String(sectionCount) : "--", tone: sectionCount ? "good" : "neutral" },
            { label: "高风险", value: String(highRiskCount), tone: highRiskCount ? "danger" : "good" },
        ],
        primaryAction: derivePrimaryAction({
            configured: options.configured,
            mode: options.mode,
            missingFactsCount: missingFacts.length,
            task: options.task,
            dirty: options.dirty,
            hasReviewFile: Boolean(options.reviewFileName),
        }),
        billingNote: deriveBillingNote(options.task?.costCredits),
    };
}

function derivePrimaryAction(options: {
    configured: boolean;
    mode: ContractWorkbenchMode;
    missingFactsCount: number;
    task?: Pick<ContractGenerationTask, "status" | "riskFindings"> | null;
    dirty: boolean;
    hasReviewFile: boolean;
}): ContractWorkbenchAction {
    if (!options.configured) return { key: "configure", label: "等待配置", tone: "blocked" };
    if (options.task && BUSY_STATUSES.has(options.task.status)) return { key: "wait", label: "处理中", tone: "secondary" };
    if (!options.task && options.mode === "draft" && options.missingFactsCount > 0) return { key: "complete_facts", label: "补齐事实", tone: "blocked" };
    if (!options.task && options.mode === "review" && !options.hasReviewFile) return { key: "upload_review", label: "选择文件", tone: "blocked" };
    if (!options.task) return { key: options.mode === "review" ? "upload_review" : "generate", label: options.mode === "review" ? "开始审查" : "生成合同", tone: "primary" };
    if (options.dirty) return { key: "save", label: "保存修改", tone: "primary" };
    if ((options.task.riskFindings?.length ?? 0) > 0) return { key: "export", label: "导出结果", tone: "primary" };
    return { key: "review", label: "风险预检", tone: "primary" };
}

function deriveBillingNote(costCredits?: number) {
    return typeof costCredits === "number"
        ? `按后台价格组预扣 ${costCredits} 积分；失败按账务事实退回`
        : "按后台价格组预扣；失败按账务事实退回";
}

export function deriveContractInspectorTabs(options: {
    riskCount: number;
    versionCount: number;
    hasRewritePreview: boolean;
    canExport: boolean;
}): ContractInspectorTab[] {
    return [
        { key: "risks", label: "风险", badge: options.riskCount ? String(options.riskCount) : undefined },
        { key: "rewrite", label: "改写", badge: options.hasRewritePreview ? "新建议" : undefined },
        { key: "versions", label: "版本", badge: options.versionCount ? String(options.versionCount) : undefined },
        { key: "export", label: "导出", badge: options.canExport ? "可用" : undefined },
    ];
}
