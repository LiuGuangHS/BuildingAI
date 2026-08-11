import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const rules = await import("../src/api/modules/contract-generation/services/contract-review-rules.ts");
const serviceSource = readFileSync(new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url), "utf8");

test("Finding is current only when its section and source revision match the document", () => {
    const finding = { sectionId: "pricing", sourceRevision: 4, quote: "10000 元" };

    assert.equal(rules.isFindingCurrent(finding, { sectionId: "pricing", revision: 4 }), true);
    assert.equal(rules.isFindingCurrent(finding, { sectionId: "pricing", revision: 5 }), false);
    assert.equal(rules.isFindingCurrent(finding, { sectionId: "scope", revision: 4 }), false);
});

test("Finding without verifiable evidence is stale and cannot be accepted", () => {
    assert.equal(rules.isFindingCurrent({ sectionId: "pricing", sourceRevision: 4 }, { sectionId: "pricing", revision: 4 }), false);
    assert.equal(rules.canAcceptFinding({ sectionId: "pricing", sourceRevision: 4, quote: "10000 元" }, { sectionId: "pricing", revision: 4 }), true);
});

test("review output is rejected instead of silently truncating long source content", () => {
    assert.throws(() => rules.assertReviewContentWithinLimit("x".repeat(rules.MAX_REVIEW_CHARS + 1)), /超过审查长度上限/);
    assert.doesNotThrow(() => rules.assertReviewContentWithinLimit("x".repeat(rules.MAX_REVIEW_CHARS)));
    assert.doesNotMatch(serviceSource, /content\.slice\(0,\s*UPLOAD_REVIEW_MAX_CHARS\)/);
});

test("review findings carry source revision evidence in the service normalization path", () => {
    assert.match(serviceSource, /sourceRevision/);
    assert.match(serviceSource, /sectionId/);
    assert.match(serviceSource, /quote/);
});

test("upload review parses a safely downloaded or platform-owned buffer", () => {
    assert.match(serviceSource, /downloadPublicHttpUrl/);
    assert.match(serviceSource, /createReadStream/);
    assert.match(serviceSource, /parseFromBuffer/);
    assert.doesNotMatch(serviceSource, /llmFileParser\.parseAndFormat\(fileUrl/);
});

test("upload review never stores fileUrl in task variables and reads plugin files with the extension root", () => {
    assert.match(serviceSource, /variables: \{\}/);
    assert.match(serviceSource, /requestPayload: \{ \.\.\.dto, fileId: fileSource\.fileId \}/);
    assert.match(serviceSource, /providerMetadata: \{ source: "upload-review", fileId: fileSource\.fileId/);
    assert.match(serviceSource, /createReadStream\(fileId, \{ extensionId: EXTENSION_ID \}\)/);
    assert.doesNotMatch(serviceSource, /fileUrl\.startsWith/);
});

test("upload review handles missing streams and revalidates file ownership and metadata", () => {
    assert.match(serviceSource, /if \(!stream\)/);
    assert.match(serviceSource, /file\.url\.startsWith\("\/"\)/);
    assert.match(serviceSource, /file\.uploaderId !== expectedUserId/);
    assert.match(serviceSource, /file\.extensionIdentifier !== EXTENSION_ID/);
    assert.match(serviceSource, /assertReviewFileSupported\(file\)/);
    assert.match(serviceSource, /没有可读取的内容/);
});

test("export file resolution rechecks task owner, plugin ownership, and storage before download", () => {
    assert.match(serviceSource, /async getExportFile\(userId: string, taskId: string\)/);
    assert.match(serviceSource, /getTaskDetail\(userId, taskId\)/);
    assert.match(serviceSource, /file\.uploaderId !== userId/);
    assert.match(serviceSource, /file\.extensionIdentifier !== EXTENSION_ID/);
    assert.match(serviceSource, /createReadStream\(fileId, \{ extensionId: EXTENSION_ID \}\)/);
});
