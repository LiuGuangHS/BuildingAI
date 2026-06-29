import assert from "node:assert/strict";
import { test } from "node:test";

const model = await import("../src/web/components/contract-editor/contract-document-model.ts");

test("buildDocumentSections creates a contract-shaped placeholder when no template exists", () => {
    const sections = model.buildDocumentSections({ sections: [], variables: {} });

    assert.deepEqual(sections.map((section) => section.title), [
        "合同主体",
        "服务内容",
        "服务期限",
        "费用与付款",
        "验收标准",
        "违约责任",
        "争议解决",
    ]);
    assert.equal(sections[0].source, "placeholder");
    assert.match(sections[0].content, /甲方/);
});

test("buildDocumentSections keeps locally edited sections as draft source before generation", () => {
    const sections = model.buildDocumentSections({
        sections: [{ title: "服务范围", content: "先写入用户确认过的服务边界。" }],
        variables: {},
        draft: true,
    });

    assert.equal(sections[0].id, "draft-section-0");
    assert.equal(sections[0].source, "draft");
    assert.deepEqual(model.editableSectionsFromDocument(sections), [
        { id: "draft-section-0", title: "服务范围", content: "先写入用户确认过的服务边界。", importance: undefined },
    ]);
});

test("getSectionRiskAnnotation prefers sectionId and keeps title fallback", () => {
    const risks = [
        { sectionTitle: "付款", level: "low", issue: "标题兜底", suggestion: "补充付款安排" },
        { sectionId: "sec-1", sectionTitle: "其他", level: "high", issue: "精准命中", suggestion: "补充违约责任" },
    ];

    const annotation = model.getSectionRiskAnnotation({ id: "sec-1", title: "费用与付款" }, risks);
    assert.equal(annotation.label, "高风险");
    assert.equal(annotation.issue, "精准命中");

    const fallback = model.getSectionRiskAnnotation("费用与付款", risks);
    assert.equal(fallback.label, "低风险");
});
