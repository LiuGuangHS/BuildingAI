import assert from "node:assert/strict";
import { test } from "node:test";

const model = await import("../src/web/components/contract-workbench/contract-inspector-model.ts");

test("deriveRiskReasoning returns structured AI explanation", () => {
    const reasoning = model.deriveRiskReasoning(
        {
            sectionTitle: "费用与付款",
            level: "high",
            issue: "缺少逾期付款责任",
            suggestion: "补充逾期付款违约金",
            replacementText: "逾期付款的，每逾期一日按应付未付款项的万分之五支付违约金。",
        },
        0,
    );

    assert.equal(reasoning.severityLabel, "高风险");
    assert.equal(reasoning.confidence, 92);
    assert.match(reasoning.impact, /履约争议/);
    assert.equal(reasoning.canApplyRewrite, true);
});
