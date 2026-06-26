import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const generationServiceSource = readFileSync(
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    "utf8",
);
const modelConfigServiceSource = readFileSync(
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
    "utf8",
);
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("image prompt enhancement uses main-site LLM models without direct AI SDK or image provider ids", () => {
    assert.equal(generationServiceSource.includes('from "@buildingai/ai-sdk"'), false);
    assert.equal(packageSource.includes("@buildingai/ai-sdk"), false);
    assert.equal(generationServiceSource.includes("PublicAiModelService"), true);
    assert.equal(generationServiceSource.includes("this.aiModelService.generateText(promptEnhancerModelId"), true);
    assert.equal(generationServiceSource.includes("this.aiModelService.generateText(dto.modelId"), false);
    assert.equal(modelConfigServiceSource.includes("listActiveLlmModels()"), true);
    assert.equal(modelConfigServiceSource.includes("this.publicAiModelService.getModelInfo(modelId)"), true);
    assert.equal(modelConfigServiceSource.includes('model.modelType !== "llm"'), true);
    assert.equal(generationServiceSource.includes("this.aiModelService.getProviderConfig(modelInfo.id)"), false);
    assert.equal(generationServiceSource.includes("this.aiModelService.getProviderAdapter("), false);
    assert.equal(generationServiceSource.includes("const result = await generateText("), false);
});
