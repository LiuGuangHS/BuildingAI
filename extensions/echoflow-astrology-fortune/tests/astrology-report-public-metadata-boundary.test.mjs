import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-report-public-metadata.ts", import.meta.url),
    "utf8",
);

describe("astrology report public metadata boundary", () => {
    it("uses the extension SDK defined-field helper for public context output", () => {
        assert.match(source, /import \{ buildDefinedWhere \} from "@buildingai\/extension-sdk\/utils\/pure";/);
        assert.match(source, /buildDefinedWhere<Partial<AstrologyReportGenerationContext>>\(/);
        assert.doesNotMatch(source, /optionalString\(/);
        assert.doesNotMatch(source, /Partial<Record<Key, string>>/);
    });
});
