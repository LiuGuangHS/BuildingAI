import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import type { ContractGenerationTask, ContractRiskFinding, RiskActions } from "../../../db/entities";
import { contractSectionsToDocument, type ContractBlock } from "../../../contract-document-ast";

function paragraph(text: string, options: { bold?: boolean; size?: number; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
    return new Paragraph({
        heading: options.heading,
        alignment: options.alignment,
        spacing: { after: 180, line: 360 },
        children: [new TextRun({ text, bold: options.bold, size: options.size ?? 24 })],
    });
}

function riskParagraph(risk: ContractRiskFinding, index: number, actions: RiskActions = {}) {
    const label = risk.level === "high" ? "高风险" : risk.level === "medium" ? "中风险" : "低风险";
    const action = actions[risk.id || `${index}:${risk.sectionTitle}:${risk.issue}`]?.status;
    const status = action === "accepted" ? "已采纳" : action === "ignored" ? "已忽略" : "待处理";
    const quote = risk.quote ? `\n命中原文：${risk.quote}` : "";
    const replacement = risk.replacementText ? `\n建议替换：${risk.replacementText}` : "";
    return paragraph(`${label}｜${status}｜${risk.sectionTitle}\n问题：${risk.issue}\n建议：${risk.suggestion}${quote}${replacement}`);
}

export async function buildContractDocx(task: Pick<ContractGenerationTask, "title" | "summary" | "sections" | "riskFindings" | "legalTerms" | "riskActions">, options: { exportType?: "contract" | "contract_with_report" | "risk_report"; includeRiskReport?: boolean } = {}) {
    const document = contractSectionsToDocument(task.sections, { title: task.title });
    const exportType = options.exportType ?? (options.includeRiskReport ? "contract_with_report" : "contract");
    const children: Paragraph[] = exportType === "risk_report" ? [] : [
        paragraph(document.title, { bold: true, size: 36, alignment: AlignmentType.CENTER }),
        paragraph(""),
        ...(task.summary ? [paragraph(`合同摘要：${task.summary}`)] : []),
        paragraph(""),
        ...document.sections.flatMap((section, index) => [
            paragraph(`第 ${index + 1} 条 ${section.title}`, { bold: true, heading: HeadingLevel.HEADING_2 }),
            ...section.blocks.flatMap(blockToParagraphs),
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
        children.push(paragraph(`${task.title} - AI 法务批注报告`, { bold: true, size: 34, alignment: AlignmentType.CENTER }), paragraph(""));
        if (!task.riskFindings?.length && !task.legalTerms?.length) {
            children.push(paragraph("当前合同暂无 AI 法务批注或法律术语解释。"));
        }
    }

    if ((exportType === "contract_with_report" || exportType === "risk_report") && task.riskFindings?.length) {
        children.push(paragraph(""), paragraph("AI 法务批注报告（内部参考）", { bold: true, heading: HeadingLevel.HEADING_2 }), ...task.riskFindings.map((risk, index) => riskParagraph(risk, index, task.riskActions ?? {})));
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

function blockToParagraphs(block: ContractBlock): Paragraph[] {
    if (block.type === "list") {
        return block.items.map((item, index) => paragraph(`${block.ordered ? `${index + 1}.` : "•"} ${item}`));
    }
    if (block.type === "table") {
        return block.rows.map((row) => paragraph(row.join(" | ")));
    }
    return [paragraph(block.text)];
}
