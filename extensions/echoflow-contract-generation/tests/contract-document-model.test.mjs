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

test("documentSectionsToPlateValue preserves section titles and multiline content", () => {
    const value = model.documentSectionsToPlateValue([
        { title: "付款安排", content: "首付款 30%\n尾款 70%", source: "task" },
    ]);

    assert.equal(value[0].type, "p");
    assert.equal(value[0].children[0].text, "第 1 条 付款安排");
    assert.deepEqual(value.slice(1).map((node) => node.children[0].text), ["首付款 30%", "尾款 70%"]);
});

test("sectionContentToPlateValue round-trips editable section body text", () => {
    const value = model.sectionContentToPlateValue("甲方委托乙方提供服务。\n乙方应按期交付。");

    assert.deepEqual(value.map((node) => node.children[0].text), ["甲方委托乙方提供服务。", "乙方应按期交付。"]);
    assert.equal(model.plateValueToPlainText(value), "甲方委托乙方提供服务。\n乙方应按期交付。");
});

test("plateValueToContractSections parses contract paragraph boundaries and keeps previous ids", () => {
    const sections = model.plateValueToContractSections(
        [
            { type: "p", children: [{ text: "第 1 条 服务范围" }] },
            { type: "p", children: [{ text: "乙方提供系统实施服务。" }] },
            { type: "p", children: [{ text: "2. 费用与付款" }] },
            { type: "p", children: [{ text: "合同价款人民币 100,000 元。" }] },
        ],
        [
            { id: "a", title: "旧服务范围", content: "old", importance: "important" },
            { id: "b", title: "旧费用", content: "old" },
        ],
    );

    assert.deepEqual(sections, [
        { id: "a", title: "服务范围", content: "乙方提供系统实施服务。", importance: "important" },
        { id: "b", title: "费用与付款", content: "合同价款人民币 100,000 元。", importance: undefined },
    ]);
});

test("plateValueToContractSections falls back to a single body section without headings", () => {
    const sections = model.plateValueToContractSections(
        [
            { type: "p", children: [{ text: "这一段没有标题。" }] },
            { type: "p", children: [{ text: "仍应保存为合同正文。" }] },
        ],
        [{ id: "body", title: "原正文", content: "old" }],
    );

    assert.deepEqual(sections, [
        { id: "body", title: "原正文", content: "这一段没有标题。\n仍应保存为合同正文。", importance: undefined },
    ]);
});
