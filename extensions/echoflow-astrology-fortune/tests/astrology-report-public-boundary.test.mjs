import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const serializerSource = readFileSync(new URL("../src/api/modules/astrology-fortune/services/astrology-public-serializers.ts", import.meta.url), "utf8");
const publicTypesSource = readFileSync(new URL("../src/web/services/types/index.ts", import.meta.url), "utf8");

describe("astrology request key public boundary", () => {
    it("does not add requestKey or raw request data to public report contracts", () => {
        const publicReportBlock = serializerSource.slice(serializerSource.indexOf("type PublicAstrologyReport ="), serializerSource.indexOf("export type ConsoleAstrologyReport"));
        assert.doesNotMatch(publicReportBlock, /requestKey|requestPayload|targetProfile/);
        assert.doesNotMatch(publicTypesSource, /requestKey.*AstrologyReport/);
    });
});
