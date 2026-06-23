import type { ContractRiskFinding } from "../../services/types";

export type RiskReasoning = {
    key: string;
    severityLabel: string;
    confidence: number;
    sourceClause: string;
    riskPoint: string;
    impact: string;
    suggestion: string;
    canApplyRewrite: boolean;
    replacementText?: string;
};

export function deriveRiskReasoning(risk: ContractRiskFinding, index: number): RiskReasoning {
    const severityLabel = risk.level === "high" ? "高风险" : risk.level === "medium" ? "中风险" : "低风险";
    const confidence = risk.level === "high" ? 92 : risk.level === "medium" ? 84 : 76;
    const impact =
        risk.level === "high"
            ? "可能导致履约争议、付款责任不清或违约成本难以主张。"
            : risk.level === "medium"
              ? "可能增加沟通成本，建议在签署前明确边界。"
              : "属于表达或完整性优化项，可在导出前顺手修正。";

    return {
        key: `${index}:${risk.sectionTitle}:${risk.issue}`,
        severityLabel,
        confidence,
        sourceClause: risk.sectionTitle,
        riskPoint: risk.issue,
        impact,
        suggestion: risk.suggestion,
        canApplyRewrite: Boolean(risk.replacementText),
        replacementText: risk.replacementText,
    };
}
