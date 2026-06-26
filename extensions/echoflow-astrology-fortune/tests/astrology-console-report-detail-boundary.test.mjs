import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const consoleSource = readFileSync(
    new URL("../src/web/pages/console.tsx", import.meta.url),
    "utf8",
);

function componentBody(name) {
    const start = consoleSource.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = consoleSource.indexOf("\nfunction ", start + 1);
    return consoleSource.slice(start, next === -1 ? undefined : next);
}

describe("astrology console report detail diagnostics", () => {
    it("shows failure attribution from report metadata for operators", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /metadata\.failureType/);
        assert.match(body, /metadata\.failureReason/);
        assert.match(body, /label="失败类型"/);
        assert.match(body, /label="失败原因"/);
    });

    it("shows AI repair retry audit metadata for operators only", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /metadata\.aiRepairAttempted/);
        assert.match(body, /metadata\.aiRepairSucceeded/);
        assert.match(body, /metadata\.aiRepairReason/);
        assert.match(body, /label="AI 修复重试"/);
        assert.match(body, /label="修复结果"/);
        assert.match(body, /label="修复原因"/);
        assert.doesNotMatch(body, /rawProvider|rawResponse|requestPayload\)/);
    });

    it("keeps AI evidence visible in console report detail without raw provider payloads", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /report\.result\?\.evidence/);
        assert.match(body, /判断依据/);
        assert.match(body, /confidenceLabel/);
        assert.doesNotMatch(body, /rawProvider|rawResponse|requestPayload\)/);
    });

    it("keeps AI review checklist visible in console diagnostics", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /report\.result\?\.reviewChecklist/);
        assert.match(body, /复盘清单/);
        assert.match(body, /evidenceSource/);
        assert.match(body, /timebox/);
        assert.doesNotMatch(body, /rawProvider|rawResponse|requestPayload\)/);
    });

    it("keeps AI score keywords and lucky anchors visible in console diagnostics", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /report\.result\?\.scores/);
        assert.match(body, /report\.result\?\.keywords/);
        assert.match(body, /report\.result\?\.lucky/);
        assert.match(body, /评分/);
        assert.match(body, /关键词/);
        assert.match(body, /幸运锚点/);
        assert.doesNotMatch(body, /rawProvider|rawResponse|requestPayload\)/);
    });

    it("keeps AI actions risks and follow-up prompts visible in console diagnostics", () => {
        const body = componentBody("ReportDetailDialog");

        assert.match(body, /report\.result\?\.actions/);
        assert.match(body, /report\.result\?\.warnings/);
        assert.match(body, /\.map\(formatActionItem\)/);
        assert.match(body, /\.map\(formatWarningItem\)/);
        assert.match(body, /report\.result\?\.followUps/);
        assert.match(body, /行动建议/);
        assert.match(body, /风险提醒/);
        assert.match(body, /继续追问/);
        assert.doesNotMatch(body, /rawProvider|rawResponse|requestPayload\)/);
    });
});
