import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url),
    "utf8",
);

test("contract model config only preserves the explicit pricePerContract field", () => {
    assert.match(serviceSource, /private normalizeModelConfig\(model: PublicAiModelInfo\): Record<string, unknown> \| null \{/);
    assert.match(serviceSource, /private pickContractModelConfig\(config: Record<string, unknown>\)/);
    assert.match(serviceSource, /if \(field === "pricePerContract"/);
    assert.doesNotMatch(serviceSource, /Object\.assign\(accumulator, item\)/);
    assert.doesNotMatch(serviceSource, /return model\.modelConfig as Record<string, unknown>/);
});
