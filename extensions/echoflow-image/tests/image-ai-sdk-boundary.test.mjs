import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const generationServiceSource = readFileSync(
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    "utf8",
);
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("image prompt optimization uses the extension SDK text generation entrypoint", () => {
    assert.equal(generationServiceSource.includes('from "@buildingai/ai-sdk"'), false);
    assert.equal(packageSource.includes("@buildingai/ai-sdk"), false);
    assert.ok(generationServiceSource.includes("PublicAiModelService"));
    assert.ok(generationServiceSource.includes("this.aiModelService.generateText("));
    assert.equal(generationServiceSource.includes("this.aiModelService.getProviderConfig(modelInfo.id)"), false);
    assert.equal(generationServiceSource.includes("this.aiModelService.getProviderAdapter("), false);
    assert.equal(generationServiceSource.includes("const result = await generateText("), false);
});
