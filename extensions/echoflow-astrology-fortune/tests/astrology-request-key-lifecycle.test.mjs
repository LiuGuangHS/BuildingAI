import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(new URL("../src/web/pages/index.tsx", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../src/web/services/types/index.ts", import.meta.url), "utf8");
const mutationSource = readFileSync(new URL("../src/web/services/web/astrology-fortune.ts", import.meta.url), "utf8");

function functionBody(name) {
    const start = pageSource.indexOf(`    async function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = pageSource.indexOf("\n    async function ", start + 1);
    return pageSource.slice(start, next === -1 ? undefined : next);
}

describe("astrology request key lifecycle", () => {
    it("requires requestKey in the API parameters and leaves key creation to the page intent boundary", () => {
        assert.match(typesSource, /export type GenerateAstrologyReportParams = \{[\s\S]*?requestKey: string;/);
        assert.doesNotMatch(mutationSource, /crypto\.randomUUID\(\)/);
        assert.doesNotMatch(mutationSource, /localStorage|sessionStorage/);
    });

    it("reuses a failed submit key for the same intent and creates a fresh key for regenerate", () => {
        const submitBody = functionBody("handleGenerateReport");
        const regenerateBody = functionBody("handleRegenerate");
        assert.match(submitBody, /retryRequestSignature === signature && retryRequestKey/);
        assert.match(submitBody, /setRetryRequestKey\(requestKey\)/);
        assert.match(submitBody, /setRetryRequestKey\(null\)/);
        assert.match(regenerateBody, /const requestKey = createAstrologyRequestKey\(\)/);
        assert.match(regenerateBody, /setRetryRequestKey\(requestKey\)/);
    });

    it("does not persist request keys in browser storage", () => {
        assert.doesNotMatch(pageSource, /localStorage|sessionStorage/);
    });
});
