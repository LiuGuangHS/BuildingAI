import type { ContractRiskFinding, ContractSection, ContractTemplate, ContractTemplateField } from "../../services/types";

export type DraftCheckItem = {
    key: string;
    label: string;
    complete: boolean;
};

export type DocumentSection = ContractSection & {
    source: "task" | "draft" | "template" | "placeholder";
};

const riskRank: Record<ContractRiskFinding["level"], number> = { low: 1, medium: 2, high: 3 };

export function buildDocumentSections(options: {
    sections: ContractSection[];
    template?: ContractTemplate;
    variables: Record<string, string>;
    draft?: boolean;
}): DocumentSection[] {
    if (options.sections.length > 0) {
        return options.sections.map((section, index) => ({
            id: section.id ?? `${options.draft ? "draft" : "task"}-section-${index}`,
            title: section.title || `第 ${index + 1} 条`,
            content: section.content || "待补充条款内容。",
            importance: section.importance,
            source: options.draft ? "draft" : "task",
        }));
    }

    if (options.template) {
        const variablePreview = buildVariablePreview(options.template.fields, options.variables);
        const defaults = options.template.defaultSections.length > 0
            ? options.template.defaultSections
            : ["合同主体", "服务范围", "费用与付款", "交付与验收", "违约责任", "争议解决"];

        return defaults.map((title, index) => ({
            id: `template-section-${index}`,
            title,
            content: draftContentForTitle(title, variablePreview),
            importance: index <= 1 ? "important" : "normal",
            source: "template",
        }));
    }

    return ["合同主体", "服务内容", "服务期限", "费用与付款", "验收标准", "违约责任", "争议解决"].map((title, index) => ({
        id: `placeholder-section-${index}`,
        title,
        content: draftContentForTitle(title, {}),
        importance: index <= 1 ? "important" : "normal",
        source: "placeholder",
    }));
}

export function editableSectionsFromDocument(sections: DocumentSection[]): ContractSection[] {
    return sections
        .filter((section) => section.source === "task" || section.source === "draft")
        .map(({ source: _source, ...section }) => ({
            id: section.id,
            title: section.title,
            content: section.content,
            importance: section.importance,
        }));
}

export type ContractPlateText = {
    text?: string;
    children?: ContractPlateText[];
};

export type ContractPlateNode = {
    type?: string;
    children?: ContractPlateText[];
};

export function documentSectionsToPlateValue(sections: DocumentSection[]): ContractPlateNode[] {
    return sections.flatMap((section, index) => {
        const title = section.title.trim() || `第 ${index + 1} 条`;
        const contentLines = (section.content.trim() || "待补充条款内容。").split("\n");
        return [
            { type: "p", children: [{ text: `第 ${index + 1} 条 ${title}` }] },
            ...contentLines.map((line) => ({ type: "p" as const, children: [{ text: line }] })),
        ];
    });
}

export function sectionContentToPlateValue(content: string): ContractPlateNode[] {
    const lines = (content.trim() || "待补充条款内容。").split("\n");
    return lines.map((line) => ({ type: "p", children: [{ text: line }] }));
}

export function plateValueToPlainText(value: ContractPlateNode[]): string {
    return value.map((node) => getPlateNodeText(node)).join("\n").trim();
}

export function plateValueToContractSections(value: ContractPlateNode[], previousSections: ContractSection[]): ContractSection[] {
    const parsed: ContractSection[] = [];
    let currentTitle = "";
    let currentLines: string[] = [];

    function flushSection() {
        const title = stripSectionNumber(currentTitle || `第 ${parsed.length + 1} 条`);
        const content = currentLines.join("\n").trim();
        if (!title && !content) return;
        const previous = previousSections[parsed.length];
        parsed.push({
            id: previous?.id,
            title: title || previous?.title || `第 ${parsed.length + 1} 条`,
            content: content || "待补充条款内容。",
            importance: previous?.importance,
        });
    }

    for (const node of value) {
        const text = getPlateNodeText(node).trim();
        const isSectionBoundary = /^h[1-3]$/.test(node.type ?? "") || /^(?:第\s*)?\d+\s*(?:条|[.、])\s*\S+/.test(text);
        if (isSectionBoundary) {
            flushSection();
            currentTitle = text;
            currentLines = [];
            continue;
        }
        if (text || currentTitle) currentLines.push(text);
    }

    flushSection();

    if (parsed.length > 0) return parsed;

    const plainText = value.map((node) => getPlateNodeText(node)).join("\n").trim();
    if (!plainText) return previousSections.length > 0 ? previousSections : [];

    return [
        {
            id: previousSections[0]?.id,
            title: previousSections[0]?.title || "合同正文",
            content: plainText,
            importance: previousSections[0]?.importance,
        },
    ];
}

export function getDraftChecklist(template: ContractTemplate | undefined, variables: Record<string, string>): DraftCheckItem[] {
    if (!template) return [];
    return template.fields.map((field) => ({
        key: field.key,
        label: field.label,
        complete: !field.required || Boolean(String(variables[field.key] ?? "").trim()),
    }));
}

export function getCompletionSummary(template: ContractTemplate | undefined, variables: Record<string, string>) {
    const checklist = getDraftChecklist(template, variables);
    const required = checklist.filter((item) => {
        const field = template?.fields.find((candidate) => candidate.key === item.key);
        return field?.required;
    });
    const completed = required.filter((item) => item.complete).length;
    const missing = required.filter((item) => !item.complete);

    return {
        checklist,
        completed,
        missing,
        requiredTotal: required.length,
    };
}

export function getSectionRiskAnnotation(sectionTitle: string, risks: ContractRiskFinding[]) {
    const risk = risks
        .filter((item) => sectionTitle.includes(item.sectionTitle) || item.sectionTitle.includes(sectionTitle))
        .sort((left, right) => riskRank[right.level] - riskRank[left.level])[0];
    if (!risk) return { label: "AI 已识别", level: undefined, issue: "" };
    return {
        label: risk.level === "high" ? "高风险" : risk.level === "medium" ? "中风险" : "低风险",
        level: risk.level,
        issue: risk.issue,
    };
}

function buildVariablePreview(fields: ContractTemplateField[], variables: Record<string, string>) {
    return fields.reduce<Record<string, string>>((result, field) => {
        const value = String(variables[field.key] ?? "").trim();
        if (value) result[field.label] = value;
        return result;
    }, {});
}

function draftContentForTitle(title: string, variables: Record<string, string>) {
    const partyA = findVariable(variables, ["甲方", "委托方", "买方", "出租方", "雇主"]);
    const partyB = findVariable(variables, ["乙方", "受托方", "卖方", "承租方", "劳动者"]);
    const amount = findVariable(variables, ["费用", "金额", "价格", "租金", "报酬"]);
    const period = findVariable(variables, ["期限", "周期", "日期"]);
    const scope = findVariable(variables, ["服务", "内容", "范围", "交付", "职责"]);
    const dispute = findVariable(variables, ["争议", "法院", "仲裁", "地点"]);

    if (/主体|当事/.test(title)) {
        return `甲方：${partyA || "待填写"}\n乙方：${partyB || "待填写"}\n双方将在生成初稿后补全主体资格、联系信息和签署安排。`;
    }
    if (/服务|内容|范围|交付|职责/.test(title)) {
        return scope || "待根据服务范围、交付标准和双方职责生成条款。";
    }
    if (/费用|金额|付款|支付|结算|租金|报酬/.test(title)) {
        return `合同费用：${amount || "待填写"}\n付款节点、发票、逾期责任和结算方式将在生成初稿后补全。`;
    }
    if (/期限|周期|日期|生效/.test(title)) {
        return period || "待填写合同生效日期、履行周期和终止条件。";
    }
    if (/争议|法院|仲裁|法律/.test(title)) {
        return dispute || "待确认争议解决方式、管辖地和适用法律。";
    }
    if (/违约|保密|知识产权|验收/.test(title)) {
        return "待根据合同类型和双方立场生成可执行的责任、验收和保护条款。";
    }
    return "待根据已填写的合同信息生成条款内容。";
}

function findVariable(variables: Record<string, string>, keywords: string[]) {
    const entry = Object.entries(variables).find(([label, value]) => keywords.some((keyword) => label.includes(keyword)) && value);
    return entry?.[1] ?? "";
}

function getPlateNodeText(node: ContractPlateNode | ContractPlateText): string {
    const ownText = "text" in node ? node.text ?? "" : "";
    const childText = node.children?.map((child) => getPlateNodeText(child)).join("") ?? "";
    return ownText + childText;
}

function stripSectionNumber(title: string) {
    return title.replace(/^\s*(第\s*)?\d+\s*[.、条]\s*/, "").trim();
}
