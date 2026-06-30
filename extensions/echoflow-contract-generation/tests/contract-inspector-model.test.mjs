import assert from "node:assert/strict";
import { test } from "node:test";

const model = await import("../src/web/components/contract-workbench/contract-inspector-model.ts");

test("deriveRiskReasoning returns structured AI explanation", () => {
    const reasoning = model.deriveRiskReasoning(
        {
            id: "risk-1",
            sectionTitle: "费用与付款",
            level: "high",
            issue: "缺少逾期付款责任",
            suggestion: "补充逾期付款违约金",
            replacementText: "逾期付款的，每逾期一日按应付未付款项的万分之五支付违约金。",
            quote: "付款时间另行协商。",
        },
        0,
    );

    assert.equal(reasoning.key, "risk-1");
    assert.equal(reasoning.severityLabel, "高风险");
    assert.equal(reasoning.quote, "付款时间另行协商。");
    assert.equal("confidence" in reasoning, false);
    assert.equal("impact" in reasoning, false);
    assert.equal(reasoning.riskPoint, "缺少逾期付款责任");
    assert.equal(reasoning.suggestion, "补充逾期付款违约金");
    assert.equal(reasoning.canApplyRewrite, true);
});

test("deriveRiskReasoning labels missing fact annotations", () => {
    const reasoning = model.deriveRiskReasoning(
        {
            id: "missing-party-b",
            kind: "missing_fact",
            sectionTitle: "合同主体",
            level: "medium",
            issue: "缺少乙方名称",
            suggestion: "导出前补齐乙方名称。",
        },
        0,
    );

    assert.equal(reasoning.severityLabel, "待补充");
});
