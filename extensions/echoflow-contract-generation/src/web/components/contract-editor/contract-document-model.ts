import type { ContractRiskFinding, ContractSection, ContractTemplate, ContractTemplateField } from "../../services/types";
import * as sharedContractAst from "../../../api/contract-document-ast.ts";

export type DraftCheckItem = {
    key: string;
    label: string;
    complete: boolean;
};

export type DocumentSection = ContractSection & {
    source: "task" | "draft" | "template" | "placeholder";
};

type PlateTextNode = { text?: string; [key: string]: unknown };
type PlateNode = { type?: string; id?: string; sectionId?: string; title?: string; importance?: ContractSection["importance"]; children?: unknown[]; [key: string]: unknown };

export type ContractBlock =
    | { type: "heading" | "paragraph"; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "table"; rows: string[][] };

export type ContractAstSection = {
    id: string;
    title: string;
    importance?: ContractSection["importance"];
    blocks: ContractBlock[];
};

export type ContractDocumentAst = {
    title: string;
    revision: number;
    sections: ContractAstSection[];
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    signatureBlocks: Array<{ party: string; label: string }>;
};

const riskRank: Record<ContractRiskFinding["level"], number> = { low: 1, medium: 2, high: 3 };
const EMPTY_PLATE_PARAGRAPH = { type: "p", children: [{ text: "" }] };

export function contractSectionsToPlateValue(sections: ContractSection[]): PlateNode[] {
    return sharedContractAst.contractSectionsToPlateValue(sections);
}

export function plateValueToContractDocument(value: unknown, options: { title?: string; revision?: number; variables?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}): ContractDocumentAst {
    return sharedContractAst.plateValueToContractDocument(value, options);
}

export function contractDocumentToSections(document: ContractDocumentAst): ContractSection[] {
    return sharedContractAst.contractDocumentToSections(document);
}

export function contractDocumentToPlainText(document: ContractDocumentAst): string {
    return sharedContractAst.contractDocumentToPlainText(document);
}

export function contractDocumentToMarkdown(document: ContractDocumentAst): string {
    return sharedContractAst.contractDocumentToMarkdown(document);
}

export function contractDocumentToModelInput(document: ContractDocumentAst): string {
    return sharedContractAst.contractDocumentToModelInput(document);
}

function isPlateNode(value: unknown): value is PlateNode {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseContractSection(node: PlateNode, index: number): ContractAstSection {
    const children = Array.isArray(node.children) ? node.children.filter(isPlateNode) : [];
    return {
        id: String(node.sectionId ?? node.id ?? `section-${index + 1}`),
        title: String(node.title ?? findHeading(children) ?? `第 ${index + 1} 条`),
        importance: node.importance,
        blocks: parseBlocks(children.length ? children : [EMPTY_PLATE_PARAGRAPH]),
    };
}

function parseBlocks(nodes: PlateNode[]): ContractBlock[] {
    const blocks: ContractBlock[] = [];
    for (const node of nodes) {
        const type = String(node.type ?? "p");
        if (["script", "html", "raw_html"].includes(type)) continue;
        if (["h1", "h2", "h3", "heading"].includes(type)) blocks.push({ type: "heading", text: nodeText(node) });
        else if (["ul", "ol", "list"].includes(type)) blocks.push({ type: "list", ordered: type === "ol" || Boolean(node.ordered), items: listItems(node) });
        else if (["table"].includes(type)) blocks.push({ type: "table", rows: tableRows(node) });
        else blocks.push({ type: "paragraph", text: nodeText(node) });
    }
    return blocks.length ? blocks : [{ type: "paragraph", text: "" }];
}

function nodeText(node: PlateNode): string {
    return (Array.isArray(node.children) ? node.children : []).map((child) => typeof child === "string" ? child : isPlateNode(child) ? String((child as PlateTextNode).text ?? nodeText(child)) : "").join("");
}

function listItems(node: PlateNode): string[] {
    return (Array.isArray(node.children) ? node.children : []).filter(isPlateNode).map((item) => nodeText(item));
}

function tableRows(node: PlateNode): string[][] {
    return (Array.isArray(node.children) ? node.children : []).filter(isPlateNode).map((row) => (Array.isArray(row.children) ? row.children : []).filter(isPlateNode).map((cell) => nodeText(cell)));
}

function blockToText(block: ContractBlock): string {
    if (block.type === "list") return block.items.join("\n");
    if (block.type === "table") return block.rows.map((row) => row.join(" | ")).join("\n");
    return block.text;
}

function blockToMarkdown(block: ContractBlock): string {
    if (block.type === "heading") return `### ${sanitizeMarkdown(block.text)}`;
    if (block.type === "list") return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${sanitizeMarkdown(item)}`).join("\n");
    if (block.type === "table") return block.rows.map((row) => `| ${row.map(sanitizeMarkdown).join(" | ")} |`).join("\n");
    return sanitizeMarkdown(block.text);
}

function sanitizeMarkdown(text: string): string {
    return text.replace(/<[^>]*>/g, "");
}

function findHeading(nodes: PlateNode[]): string | undefined {
    const heading = nodes.find((node) => ["h1", "h2", "h3", "heading"].includes(String(node.type)));
    return heading ? nodeText(heading) : undefined;
}

function parseSignatureBlocks(text: string): Array<{ party: string; label: string }> {
    const match = text.match(/(甲方|乙方)[^：:]*[：:](.+)/);
    return match ? [{ party: match[1], label: match[2].trim() }] : [];
}

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

export function getSectionRiskAnnotation(section: Pick<ContractSection, "id" | "title"> | string, risks: ContractRiskFinding[]) {
    const sectionTitle = typeof section === "string" ? section : section.title;
    const sectionId = typeof section === "string" ? undefined : section.id;
    const risk = risks
        .filter((item) => (item.sectionId && sectionId && item.sectionId === sectionId) || sectionTitle.includes(item.sectionTitle) || item.sectionTitle.includes(sectionTitle))
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
