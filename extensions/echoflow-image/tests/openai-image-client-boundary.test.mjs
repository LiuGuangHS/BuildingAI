import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
    new URL("../src/api/modules/generation/services/openai-image-client.ts", import.meta.url),
    "utf8",
);

test("openai image client uses the extension SDK defined-field helper for request bodies", () => {
    assert.match(source, /import \{ buildDefinedWhere, safeJsonParse \} from "@buildingai\/extension-sdk\/utils\/pure";/);
    assert.match(source, /buildDefinedWhere<Record<string, unknown>>\(\{/);
    assert.doesNotMatch(source, /function removeUndefined/);
    assert.doesNotMatch(source, /Object\.fromEntries\(Object\.entries\(value\)\.filter\(\(\[, item\]\) => item !== undefined\)\)/);
});
