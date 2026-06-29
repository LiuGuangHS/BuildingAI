import type { ContractRiskFinding } from "../../services/types";

export type RiskReasoning = {
    key: string;
    severityLabel: string;
    sourceClause: string;
    riskPoint: string;
    suggestion: string;
    quote?: string;
    canApplyRewrite: boolean;
    replacementText?: string;
};

export function deriveRiskReasoning(risk: ContractRiskFinding, index: number): RiskReasoning {
    const severityLabel = risk.level === "high" ? "高风险" : risk.level === "medium" ? "中风险" : "低风险";

    return {
        key: risk.id || `${index}:${risk.sectionTitle}:${risk.issue}`,
        severityLabel,
        sourceClause: risk.sectionTitle,
        riskPoint: risk.issue,
        suggestion: risk.suggestion,
        quote: risk.quote,
        canApplyRewrite: Boolean(risk.replacementText),
        replacementText: risk.replacementText,
    };
}
