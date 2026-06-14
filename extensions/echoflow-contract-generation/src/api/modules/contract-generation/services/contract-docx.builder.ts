import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import type { ContractGenerationTask, ContractRiskFinding, ContractSection } from "../../../db/entities";

function paragraph(text: string, options: { bold?: boolean; size?: number; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
    return new Paragraph({
        heading: options.heading,
        alignment: options.alignment,
        spacing: { after: 180, line: 360 },
        children: [new TextRun({ text, bold: options.bold, size: options.size ?? 24 })],
    });
}

function riskParagraph(risk: ContractRiskFinding) {
    const label = risk.level === "high" ? "高风险" : risk.level === "medium" ? "中风险" : "低风险";
    return paragraph(`${label}｜${risk.sectionTitle}：${risk.issue}。建议：${risk.suggestion}`);
}

export async function buildContractDocx(task: Pick<ContractGenerationTask, "title" | "summary" | "sections" | "riskFindings" | "legalTerms">, options: { exportType?: "contract" | "contract_with_report" | "risk_report"; includeRiskReport?: boolean } = {}) {
    const sections = normalizeSections(task.sections);
    const exportType = options.exportType ?? (options.includeRiskReport ? "contract_with_report" : "contract");
    const children: Paragraph[] = exportType === "risk_report" ? [] : [
        paragraph(task.title, { bold: true, size: 36, alignment: AlignmentType.CENTER }),
        paragraph(""),
        ...(task.summary ? [paragraph(`合同摘要：${task.summary}`)] : []),
        paragraph(""),
        ...sections.flatMap((section, index) => [
            paragraph(`第 ${index + 1} 条 ${section.title}`, { bold: true, heading: HeadingLevel.HEADING_2 }),
            ...section.content.split("\n").filter(Boolean).map((line) => paragraph(line.trim())),
        ]),
        paragraph(""),
        paragraph("签署栏", { bold: true, heading: HeadingLevel.HEADING_2 }),
        paragraph("甲方（签章）：____________________"),
        paragraph("日期：________年____月____日"),
        paragraph("乙方（签章）：____________________"),
        paragraph("日期：________年____月____日"),
        paragraph(""),
        paragraph("免责声明", { bold: true, heading: HeadingLevel.HEADING_2 }),
        paragraph("本文件由 AI 辅助生成，仅供参考，不构成法律意见或律师服务。重要合同签署前建议咨询专业律师。"),
    ];

    if (exportType === "risk_report") {
        children.push(paragraph(`${task.title} - 风险报告`, { bold: true, size: 34, alignment: AlignmentType.CENTER }), paragraph(""));
        if (!task.riskFindings?.length && !task.legalTerms?.length) {
            children.push(paragraph("当前合同暂无风险提示或法律术语解释。"));
        }
    }

    if ((exportType === "contract_with_report" || exportType === "risk_report") && task.riskFindings?.length) {
        children.push(paragraph(""), paragraph("风险提示（内部参考）", { bold: true, heading: HeadingLevel.HEADING_2 }), ...task.riskFindings.map(riskParagraph));
    }

    if ((exportType === "contract_with_report" || exportType === "risk_report") && task.legalTerms?.length) {
        children.push(
            paragraph(""),
            paragraph("法律术语解释", { bold: true, heading: HeadingLevel.HEADING_2 }),
            ...task.legalTerms.map((term) => paragraph(`${term.term}：${term.explanation}`)),
        );
    }

    const doc = new Document({ sections: [{ properties: {}, children }] });
    return Packer.toBuffer(doc);
}

function normalizeSections(sections: ContractSection[]) {
    return (Array.isArray(sections) ? sections : []).filter((section) => section.title?.trim() && section.content?.trim());
}
