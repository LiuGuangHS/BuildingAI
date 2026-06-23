import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const scriptSource = readFileSync(new URL("../scripts/smoke-web.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("astrology web smoke script", () => {
    it("is exposed as a package script without nesting pnpm", () => {
        assert.equal(packageJson.scripts?.["smoke:web"], "node scripts/smoke-web.mjs");
    });

    it("uses only public Web API paths and the platform standard response envelope", () => {
        assert.match(scriptSource, /\/\$\(identifier\)|\/\$\{identifier\}\/api\/astrology-fortune\//);
        assert.match(scriptSource, /assertStandardEnvelope/);
        assert.match(scriptSource, /payload\.code >= 20000 && payload\.code < 30000/);
        assert.match(scriptSource, /generation-status/);
        assert.match(scriptSource, /reports\/generate/);
        assert.match(scriptSource, /reports\/\$\{finishedReport\.id\}\/feedback/);
        assert.doesNotMatch(scriptSource, /consoleapi|\/console\//);
    });

    it("requires an explicit authenticated token and opt-in generation flag", () => {
        assert.match(scriptSource, /ASTROLOGY_SMOKE_TOKEN/);
        assert.match(scriptSource, /BUILDINGAI_ACCESS_TOKEN/);
        assert.match(scriptSource, /Missing ASTROLOGY_SMOKE_TOKEN/);
        assert.match(scriptSource, /ASTROLOGY_SMOKE_GENERATE === "1"/);
        assert.match(scriptSource, /generation skipped/);
    });

    it("asserts successful reports keep the structured AI contract and public serializer boundary", () => {
        assert.match(scriptSource, /assertStructuredAiResult/);
        assert.match(scriptSource, /result\.scores\.overall/);
        assert.match(scriptSource, /evidence\.confidence/);
        assert.match(scriptSource, /low.*medium.*high|high.*medium.*low/);
        assert.match(scriptSource, /action\.reason/);
        assert.match(scriptSource, /action\.timebox/);
        assert.match(scriptSource, /warning\.detail/);
        assert.match(scriptSource, /assertNoPrivateReportFields/);
        assert.match(scriptSource, /userId/);
        assert.match(scriptSource, /requestPayload/);
        assert.match(scriptSource, /secretId/);
        assert.match(scriptSource, /aiRepairAttempted/);
        assert.match(scriptSource, /aiRepairSucceeded/);
        assert.match(scriptSource, /aiRepairReason/);
    });
});
