import assert from "node:assert/strict";
import { test } from "node:test";

const documentModel = await import("../src/web/components/contract-editor/contract-document-model.ts");

test("converts stable sections through Plate value and Contract AST without losing IDs", () => {
    const sections = [
        { id: "scope", title: "服务范围", content: "提供咨询服务。\n- 需求分析\n- 实施交付", importance: "important" },
        { id: "pricing", title: "费用与付款", content: "| 项目 | 金额 |\n| --- | --- |\n| 服务费 | 10000 |", importance: "critical" },
    ];

    const value = documentModel.contractSectionsToPlateValue(sections);
    const document = documentModel.plateValueToContractDocument(value, { title: "服务合同", revision: 3 });
    const roundTrip = documentModel.contractDocumentToSections(document);

    assert.deepEqual(roundTrip, sections);
    assert.deepEqual(document.sections.map((section) => section.id), ["scope", "pricing"]);
    assert.match(documentModel.contractDocumentToPlainText(document), /服务范围/);
    assert.match(documentModel.contractDocumentToPlainText(document), /服务费/);
});

test("preserves headings, paragraphs, lists, tables, and signature blocks in the contract AST", () => {
    const document = documentModel.plateValueToContractDocument([
        { type: "h2", children: [{ text: "服务范围" }] },
        { type: "p", children: [{ text: "提供咨询服务。" }] },
        { type: "ul", children: [{ type: "li", children: [{ text: "需求分析" }] }] },
        { type: "table", children: [{ type: "tr", children: [{ type: "td", children: [{ text: "服务费" }] }] }] },
        { type: "p", children: [{ text: "甲方（签章）：____________________" }] },
    ], { title: "服务合同", revision: 1 });

    assert.deepEqual(document.sections[0].blocks.map((block) => block.type), ["heading", "paragraph", "list", "table", "paragraph"]);
    assert.equal(document.signatureBlocks[0]?.party, "甲方");
});

test("drops malformed Plate nodes and preserves an intentional empty paragraph", () => {
    const document = documentModel.plateValueToContractDocument([
        null,
        { type: "script", children: [{ text: "<script>alert(1)</script>" }] },
        { type: "p", children: [] },
        { type: "p", children: [{ text: "安全正文" }] },
    ], { title: "合同", revision: 0 });

    assert.deepEqual(document.sections[0].blocks.map((block) => block.type), ["paragraph", "paragraph"]);
    assert.equal(document.sections[0].blocks[0].text, "");
    assert.equal(documentModel.contractDocumentToPlainText(document).includes("<script>"), false);
});

test("serializes contract AST to markdown without emitting executable HTML", () => {
    const document = documentModel.plateValueToContractDocument([
        { type: "h2", children: [{ text: "服务范围" }] },
        { type: "p", children: [{ text: "<img src=x onerror=alert(1)>" }] },
    ], { title: "合同", revision: 2 });

    const markdown = documentModel.contractDocumentToMarkdown(document);

    assert.match(markdown, /服务范围/);
    assert.equal(markdown.includes("<img"), false);
    assert.equal(markdown.includes("onerror="), false);
});

test("builds a model-safe input from Contract AST without Console or provider fields", () => {
    const document = documentModel.plateValueToContractDocument([
        { type: "h2", children: [{ text: "服务范围" }] },
        { type: "p", children: [{ text: "提供咨询服务。" }] },
    ], {
        title: "合同",
        revision: 4,
        metadata: { provider: "private", promptTemplate: "private", templateVersionId: "template-v1" },
    });

    const input = documentModel.contractDocumentToModelInput(document);

    assert.equal(input.includes("private"), false);
    assert.match(input, /服务范围/);
});
