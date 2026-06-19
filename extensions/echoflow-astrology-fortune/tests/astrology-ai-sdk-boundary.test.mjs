import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
    "utf8",
);
const moduleSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/astrology-fortune.module.ts", import.meta.url),
    "utf8",
);

test("astrology reports use ai-sdk only through main-system model resolution", () => {
    const resolverIndex = serviceSource.indexOf("private async resolveLanguageModel(model: AiModel)");
    const adapterIndex = serviceSource.indexOf("this.publicAiModelService.getProviderAdapter(model.id, providerConfig)");
    const generateCalls = serviceSource.match(/generateText\(\{/g) ?? [];
    const resolvedModelCalls = serviceSource.match(/model:\s*await this\.resolveLanguageModel\(model\)/g) ?? [];

    assert.ok(serviceSource.includes('from "@buildingai/ai-sdk"'));
    assert.ok(serviceSource.includes("PublicAiModelService"));
    assert.ok(resolverIndex > 0);
    assert.ok(serviceSource.includes("normalizeProviderConfig(await this.publicAiModelService.getProviderConfig(model.id))"));
    assert.ok(adapterIndex > resolverIndex);
    assert.ok(generateCalls.length > 0);
    assert.equal(resolvedModelCalls.length, generateCalls.length);
});

test("astrology console model list uses the extension SDK instead of a direct AiModel repository", () => {
    assert.ok(serviceSource.includes("this.publicAiModelService.listActiveLlmModels()"));
    assert.equal(serviceSource.includes("@InjectRepository(AiModel)"), false);
    assert.equal(serviceSource.includes("modelRepo"), false);
    assert.equal(moduleSource.includes("AiModel"), false);
});
