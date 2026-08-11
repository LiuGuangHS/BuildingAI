export type ContractSectionLike = {
    id?: string;
    title: string;
    content: string;
    importance?: "normal" | "important" | "critical";
};

export type PlateTextNode = { text?: string; [key: string]: unknown };
export type PlateNode = { type?: string; id?: string; sectionId?: string; title?: string; importance?: ContractSectionLike["importance"]; children?: unknown[]; [key: string]: unknown };

export type ContractBlock =
    | { type: "heading" | "paragraph"; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "table"; rows: string[][] };

export type ContractAstSection = {
    id: string;
    title: string;
    importance?: ContractSectionLike["importance"];
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

const EMPTY_PLATE_PARAGRAPH: PlateNode = { type: "p", children: [{ text: "" }] };

export function contractSectionsToPlateValue(sections: ContractSectionLike[]): PlateNode[] {
    return sections.map((section, index) => ({
        type: "contract-section",
        sectionId: section.id ?? `section-${index + 1}`,
        title: section.title,
        importance: section.importance,
        children: section.content.split("\n").map((text) => ({ type: "p", children: [{ text }] })),
    }));
}

export function plateValueToContractDocument(value: unknown, options: { title?: string; revision?: number; variables?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}): ContractDocumentAst {
    const nodes = Array.isArray(value) ? value.filter(isPlateNode) : [];
    const sections = nodes.some((node) => node.type === "contract-section")
        ? nodes.filter((node) => node.type === "contract-section").map((node, index) => parseContractSection(node, index))
        : [parseContractSection({ title: findHeading(nodes) || "合同正文", children: nodes }, 0)];
    return withSignatureBlocks({ title: options.title?.trim() || "合同", revision: options.revision ?? 0, sections, variables: options.variables, metadata: options.metadata });
}

export function contractSectionsToDocument(sections: ContractSectionLike[], options: { title?: string; revision?: number; variables?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}): ContractDocumentAst {
    const astSections = sections.map((section, index) => ({
        id: String(section.id ?? `section-${index + 1}`),
        title: String(section.title ?? `第 ${index + 1} 条`),
        importance: section.importance,
        blocks: parseTextBlocks(String(section.content ?? "")),
    }));
    return withSignatureBlocks({ title: options.title?.trim() || "合同", revision: options.revision ?? 0, sections: astSections, variables: options.variables, metadata: options.metadata });
}

export function contractDocumentToSections(document: ContractDocumentAst): ContractSectionLike[] {
    return document.sections.map((section) => ({ id: section.id, title: section.title, content: section.blocks.map(blockToText).filter((text, index) => text || index === 0).join("\n"), importance: section.importance }));
}

export function contractDocumentToPlainText(document: ContractDocumentAst): string {
    return [document.title, ...document.sections.flatMap((section) => [section.title, ...section.blocks.map(blockToText)])].filter(Boolean).join("\n");
}

export function contractDocumentToMarkdown(document: ContractDocumentAst): string {
    return document.sections.map((section) => [`## ${sanitizeMarkdown(section.title)}`, ...section.blocks.map(blockToMarkdown)].join("\n")).join("\n\n");
}

export function contractDocumentToModelInput(document: ContractDocumentAst): string {
    return contractDocumentToPlainText({ ...document, metadata: undefined, variables: undefined });
}

function withSignatureBlocks(document: Omit<ContractDocumentAst, "signatureBlocks">): ContractDocumentAst {
    const signatureBlocks = document.sections.flatMap((section) => section.blocks.flatMap((block) => block.type === "paragraph" ? parseSignatureBlocks(block.text) : []));
    return { ...document, signatureBlocks };
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

function parseTextBlocks(content: string): ContractBlock[] {
    const lines = content.split("\n");
    const blocks: ContractBlock[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index] ?? "";
        if (/^\s*[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
                items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
                index += 1;
            }
            blocks.push({ type: "list", ordered: false, items });
            continue;
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const items: string[] = [];
            while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
                items.push((lines[index] ?? "").replace(/^\s*\d+[.)]\s+/, ""));
                index += 1;
            }
            blocks.push({ type: "list", ordered: true, items });
            continue;
        }
        if (line.includes("|") && index + 1 < lines.length && (lines[index + 1] ?? "").includes("|")) {
            const rows: string[][] = [];
            while (index < lines.length && (lines[index] ?? "").includes("|")) {
                const row = (lines[index] ?? "").split("|").map((cell) => cell.trim()).filter(Boolean);
                if (row.length) rows.push(row);
                index += 1;
            }
            blocks.push({ type: "table", rows });
            continue;
        }
        blocks.push({ type: "paragraph", text: line });
        index += 1;
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
