import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildAstrologyReportGenerationContext } from "../src/api/modules/astrology-fortune/services/astrology-report-public-metadata.ts";

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
        const context = buildAstrologyReportGenerationContext({
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
        });

        assert.deepEqual(context, {
            reportType: "compatibility",
            focusArea: "关系推进节奏",
            currentState: "正在考虑是否主动沟通",
            question: "未来一周我适合主动推进吗？",
            language: "zh-CN",
            sourceReportId: "11111111-1111-4111-8111-111111111111",
            hasTargetProfile: true,
        });
        assert.equal("targetProfile" in context, false);
        assert.equal("rawSecret" in context, false);
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
        assert.match(consoleServiceSource, /\bConsoleAstrologyReport\b/);
    });
});
