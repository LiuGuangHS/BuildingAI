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
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("astrology reports use the extension SDK text generation entrypoint", () => {
    const generateCalls = serviceSource.match(/generateText\(\{/g) ?? [];
    const sdkGenerateCalls = serviceSource.match(/this\.publicAiModelService\.generateText\(/g) ?? [];

    assert.equal(serviceSource.includes('from "@buildingai/ai-sdk"'), false);
    assert.equal(packageSource.includes("@buildingai/ai-sdk"), false);
    assert.ok(serviceSource.includes("PublicAiModelService"));
    assert.equal(serviceSource.includes("private async resolveLanguageModel(model: AiModel)"), false);
    assert.equal(serviceSource.includes("normalizeProviderConfig(await this.publicAiModelService.getProviderConfig"), false);
    assert.equal(serviceSource.includes("this.publicAiModelService.getProviderAdapter("), false);
    assert.equal(generateCalls.length, 0);
    assert.ok(sdkGenerateCalls.length > 0);
});

test("astrology console model list uses the extension SDK instead of a direct AiModel repository", () => {
    assert.ok(serviceSource.includes("this.publicAiModelService.listActiveLlmModels()"));
    assert.equal(serviceSource.includes("@InjectRepository(AiModel)"), false);
    assert.equal(serviceSource.includes("modelRepo"), false);
    assert.equal(moduleSource.includes("AiModel"), false);
});

test("astrology README documents PublicAiModelService as the provider boundary", () => {
    assert.match(readmeSource, /PublicAiModelService/);
    assert.match(readmeSource, /generateText\(\)/);
    assert.match(readmeSource, /主系统边界内复用 Provider\/Secret 归一化/);
    assert.doesNotMatch(readmeSource, /获取模型、Provider Config 和 adapter/);
    assert.doesNotMatch(readmeSource, /使用 `normalizeProviderConfig\(\)` 读取主站 Secret 字段别名/);
});
