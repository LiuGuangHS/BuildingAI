import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url),
    "utf8",
);

test("contract admin config uses a whitelist view instead of spreading the stored config", () => {
    assert.match(serviceSource, /async getAdminConfig\(\) \{/);
    assert.match(serviceSource, /return \{\n\s+id: config\.id,/);
    assert.match(serviceSource, /metadata: config\.metadata \?\? null,/);
    assert.doesNotMatch(serviceSource, /return \{\n\s+\.\.\.config,/);
    assert.doesNotMatch(serviceSource, /\.\.\.config,/);
});
