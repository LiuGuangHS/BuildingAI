import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const generationServiceSource = readFileSync(
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    "utf8",
);

test("image prompt optimization uses ai-sdk only after resolving the main-system model adapter", () => {
    const adapterIndex = generationServiceSource.indexOf("this.aiModelService.getProviderAdapter(modelInfo.id, providerConfig)");
    const generateIndex = generationServiceSource.indexOf("const result = await generateText(");

    assert.ok(generationServiceSource.includes('from "@buildingai/ai-sdk"'));
    assert.ok(generationServiceSource.includes("PublicAiModelService"));
    assert.ok(generationServiceSource.includes("normalizeProviderConfig"));
    assert.ok(generationServiceSource.includes("this.aiModelService.getProviderConfig(modelInfo.id)"));
    assert.ok(adapterIndex > 0);
    assert.ok(generateIndex > adapterIndex);
});
