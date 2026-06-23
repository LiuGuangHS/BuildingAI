import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildAstrologyReportGenerationContext } from "../src/api/modules/astrology-fortune/services/astrology-report-public-metadata.ts";
import { buildAstrologyQuestionQualityContext } from "../src/api/modules/astrology-fortune/services/astrology-question-quality.ts";

const typesSource = readFileSync(
    new URL("../src/web/services/types/index.ts", import.meta.url),
    "utf8",
);
const webServiceSource = readFileSync(
    new URL("../src/web/services/web/astrology-fortune.ts", import.meta.url),
    "utf8",
);
const consoleServiceSource = readFileSync(
    new URL("../src/web/services/console/astrology-fortune.ts", import.meta.url),
    "utf8",
);

function extractTypeBlock(name) {
    const start = typesSource.indexOf(`export type ${name} =`);
    assert.notEqual(start, -1, `${name} type should exist`);
    const next = typesSource.indexOf("\nexport type ", start + 1);
    return typesSource.slice(start, next === -1 ? undefined : next);
}

describe("astrology report public metadata", () => {
    it("keeps the user-visible generation context explicit and sanitized", () => {
        const dto = {
            reportType: "compatibility",
            focusArea: "  关系推进节奏  ",
            currentState: "正在考虑是否主动沟通",
            question: "未来一周我适合主动推进吗？",
            language: "zh-CN",
            sourceReportId: "11111111-1111-4111-8111-111111111111",
            targetProfile: {
                name: "对方",
                rawSecret: "should-not-be-exposed",
            },
        };
        const context = buildAstrologyReportGenerationContext(dto, buildAstrologyQuestionQualityContext(dto));

        assert.deepEqual(context, {
            reportType: "compatibility",
            focusArea: "关系推进节奏",
            currentState: "正在考虑是否主动沟通",
            question: "未来一周我适合主动推进吗？",
            language: "zh-CN",
            sourceReportId: "11111111-1111-4111-8111-111111111111",
            hasTargetProfile: true,
            questionQuality: {
                level: "strong",
                score: 80,
                signals: ["具体场景", "时间范围", "决策目标", "当前状态"],
                missing: ["把问题写得更具体"],
            },
        });
        assert.equal("targetProfile" in context, false);
        assert.equal("rawSecret" in context, false);
    });

    it("exposes sanitized question quality in the user-visible generation context", () => {
        const dto = {
            reportType: "decision",
            focusArea: "事业选择",
            currentState: "本周要决定是否继续推进一个新工作机会",
            question: "未来一周我应该如何判断这个工作机会是否值得继续投入？",
            targetProfile: {
                rawSecret: "should-not-be-exposed",
            },
        };
        const context = buildAstrologyReportGenerationContext(dto, buildAstrologyQuestionQualityContext(dto));

        assert.equal(context.questionQuality?.level, "strong");
        assert.ok(Number(context.questionQuality?.score) >= 80);
        assert.deepEqual(context.questionQuality?.missing, []);
        assert.deepEqual(context.questionQuality?.signals, ["具体场景", "时间范围", "决策目标", "问题细节", "当前状态"]);
        assert.equal("targetProfile" in context, false);
        assert.equal(JSON.stringify(context).includes("rawSecret"), false);
    });

    it("keeps web and console report types separated", () => {
        const publicType = extractTypeBlock("AstrologyReport");
        const consoleType = extractTypeBlock("ConsoleAstrologyReport");

        for (const field of ["userId", "modelId", "providerId", "requestPayload"]) {
            assert.equal(publicType.includes(field), false, `AstrologyReport must not expose ${field}`);
            assert.equal(consoleType.includes(field), true, `ConsoleAstrologyReport should expose ${field}`);
        }

        assert.match(webServiceSource, /\bAstrologyReport\b/);
        assert.doesNotMatch(webServiceSource, /\bConsoleAstrologyReport\b/);
        assert.match(webServiceSource, /\bQueryAstrologyReportsParams\b/);
        assert.doesNotMatch(webServiceSource, /\bConsoleQueryAstrologyReportsParams\b/);
        assert.match(consoleServiceSource, /\bConsoleAstrologyReport\b/);
        assert.match(consoleServiceSource, /\bConsoleQueryAstrologyReportsParams\b/);
    });

    it("does not expose AI repair audit metadata to the user-facing web report contract", () => {
        const publicType = extractTypeBlock("AstrologyReport");

        for (const field of ["aiRepairAttempted", "aiRepairSucceeded", "aiRepairReason"]) {
            assert.equal(publicType.includes(field), false, `AstrologyReport must not expose ${field}`);
            assert.equal(webServiceSource.includes(field), false, `web service must not expose ${field}`);
        }
    });

    it("keeps web and console profile types separated", () => {
        const publicType = extractTypeBlock("AstrologyProfile");
        const consoleType = extractTypeBlock("ConsoleAstrologyProfile");

        assert.equal(publicType.includes("userId"), false, "AstrologyProfile must not expose userId");
        assert.equal(consoleType.includes("userId"), true, "ConsoleAstrologyProfile should expose userId");
        assert.doesNotMatch(webServiceSource, /\bConsoleAstrologyProfile\b/);
        assert.doesNotMatch(webServiceSource, /\bConsoleQueryAstrologyProfilesParams\b/);
        assert.match(consoleServiceSource, /\bConsoleAstrologyProfile\b/);
        assert.match(consoleServiceSource, /\bConsoleQueryAstrologyProfilesParams\b/);
    });

    it("uses the platform http query option for list filters", () => {
        assert.match(webServiceSource, /query:\s*\{\s*pageSize:\s*50\s*\}/);
        assert.match(webServiceSource, /query:\s*params/);
        assert.doesNotMatch(webServiceSource, /params:\s*params/);

        assert.match(consoleServiceSource, /query:\s*params/);
        assert.doesNotMatch(consoleServiceSource, /params:\s*params/);
    });
});
