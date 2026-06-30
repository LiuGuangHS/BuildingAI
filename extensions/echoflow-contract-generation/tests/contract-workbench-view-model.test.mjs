import assert from "node:assert/strict";
import { test } from "node:test";

import {
    deriveContractInspectorTabs,
    deriveContractWorkbenchState,
} from "../src/web/components/contract-workbench/contract-workbench-view-model.ts";

const template = {
    id: "tpl-service",
    name: "服务合同",
    industry: "企业服务",
    contractType: "service",
    description: "服务交付与验收",
    fields: [
        { key: "partyA", label: "甲方", required: true, type: "text" },
        { key: "partyB", label: "乙方", required: true, type: "text" },
        { key: "amount", label: "合同金额", required: true, type: "text" },
    ],
    defaultSections: [],
};

test("deriveContractWorkbenchState keeps the first viewport plugin-focused", () => {
    const state = deriveContractWorkbenchState({
        mode: "draft",
        configured: true,
        template,
        variables: { partyA: "北京星河科技有限公司" },
        prompt: "付款节点按 30/40/30",
        reviewFileName: "",
        task: null,
        dirty: false,
    });

    assert.equal(state.kicker, "起草");
    assert.equal(state.title, "服务合同.docx");
    assert.equal(state.primaryAction.label, "生成占位草稿");
    assert.deepEqual(state.missingFacts.map((item) => item.label), ["乙方", "合同金额"]);
    assert.equal(JSON.stringify(state).includes("用户头像"), false);
    assert.equal(JSON.stringify(state).includes("全局统计"), false);
});

test("deriveContractWorkbenchState exposes concrete AI signals after task result", () => {
    const state = deriveContractWorkbenchState({
        mode: "draft",
        configured: true,
        template,
        variables: { partyA: "北京星河科技有限公司", partyB: "上海云舟服务有限公司", amount: "100000" },
        prompt: "",
        reviewFileName: "",
        dirty: false,
        task: {
            id: "task-1",
            title: "服务合同",
            contractType: "service",
            industry: "企业服务",
            templateId: "tpl-service",
            parties: [],
            variables: {},
            prompt: null,
            summary: "服务交付合同，含付款和验收条款。",
            sections: [{ id: "s1", title: "付款", content: "按节点付款。" }],
            riskFindings: [{ level: "high", sectionTitle: "付款", issue: "缺少逾期付款责任", suggestion: "补充违约金", replacementText: "逾期付款按日承担违约金。" }],
            legalTerms: [],
            score: null,
            riskActions: {},
            status: "success",
            costCredits: 12,
            resultUrl: "",
            createdAt: "2026-06-20T00:00:00.000Z",
            updatedAt: "2026-06-20T00:00:00.000Z",
        },
    });

    assert.equal(state.title, "服务合同.docx");
    assert.equal(state.aiSignals.some((item) => item.label === "高风险" && item.value === "1"), true);
    assert.equal(state.primaryAction.label, "导出结果");
    assert.equal(state.billingNote, "按后台价格组预扣 12 积分；失败按账务事实退回");
});

test("deriveContractInspectorTabs orders contextual tabs without stacking every panel", () => {
    const tabs = deriveContractInspectorTabs({
        riskCount: 2,
        versionCount: 3,
        hasRewritePreview: true,
        canExport: true,
    });

    assert.deepEqual(tabs.map((tab) => tab.key), ["risks", "rewrite", "versions", "export"]);
    assert.equal(tabs[0].badge, "2");
    assert.equal(tabs[1].badge, "新建议");
});
