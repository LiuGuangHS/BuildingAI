import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
    TOWN_AI_CONFIG_KEY,
    TOWN_AI_DEFAULT_CONFIG,
    getTownAiDayStart,
    hasTownAiDailyLimitReached,
    shouldUseTownAiDailyLimit,
} from "../src/api/modules/town/services/town-ai-rules.mjs";

const aiServiceSource = readFileSync(new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("AI config defaults stay centralized for console and service semantics", () => {
    assert.equal(TOWN_AI_CONFIG_KEY, "default");
    assert.deepEqual(TOWN_AI_DEFAULT_CONFIG, {
        enabled: false,
        defaultModelId: null,
        temperature: 0.8,
        maxTokens: 1200,
        fallbackToRules: true,
        dailyLimitPerUser: 100,
        adviceCostPower: 0,
        chatCostPower: 0,
        eventCostPower: 0,
    });
    assert.ok(aiServiceSource.includes("...(TOWN_AI_DEFAULT_CONFIG as Partial<TownAiConfig>)"));
    assert.equal(aiServiceSource.includes("dailyLimitPerUser: 100"), false);
});

test("daily AI limit only applies to configured model calls", () => {
    assert.equal(shouldUseTownAiDailyLimit({ enabled: false, defaultModelId: "model-1", dailyLimitPerUser: 100 }), false);
    assert.equal(shouldUseTownAiDailyLimit({ enabled: true, defaultModelId: null, dailyLimitPerUser: 100 }), false);
    assert.equal(shouldUseTownAiDailyLimit({ enabled: true, defaultModelId: "model-1", dailyLimitPerUser: 0 }), false);
    assert.equal(shouldUseTownAiDailyLimit({ enabled: true, defaultModelId: "model-1", dailyLimitPerUser: 100 }), true);
});

test("daily AI limit uses a local-day window and a clear reached predicate", () => {
    const dayStart = getTownAiDayStart(new Date("2026-06-19T15:45:30.000Z"));

    assert.equal(dayStart.getHours(), 0);
    assert.equal(dayStart.getMinutes(), 0);
    assert.equal(dayStart.getSeconds(), 0);
    assert.equal(dayStart.getMilliseconds(), 0);
    assert.equal(hasTownAiDailyLimitReached(99, 100), false);
    assert.equal(hasTownAiDailyLimitReached(100, 100), true);
    assert.equal(hasTownAiDailyLimitReached(101, 100), true);
    assert.equal(hasTownAiDailyLimitReached(100, 0), false);
});

test("fallback path does not consume or block on daily AI limit before model availability is known", () => {
    const limitCheckIndex = aiServiceSource.indexOf("if (shouldUseTownAiDailyLimit(config))");
    const disabledBranchIndex = aiServiceSource.indexOf("if (!config.enabled || !config.defaultModelId)");

    assert.ok(disabledBranchIndex > 0);
    assert.ok(limitCheckIndex > disabledBranchIndex);
    assert.ok(aiServiceSource.includes("if (allowFallback) return { text: fallback, billing: this.createBillingContext(type, config, true) };"));
});

test("town AI uses the extension SDK text generation entrypoint", () => {
    assert.doesNotMatch(aiServiceSource, /from "@buildingai\/ai-sdk"/);
    assert.doesNotMatch(packageSource, /@buildingai\/ai-sdk/);
    assert.match(aiServiceSource, /PublicAiModelService/);
    assert.match(aiServiceSource, /this\.aiModelService\.generateText\(/);
    assert.doesNotMatch(aiServiceSource, /normalizeProviderConfig\(await this\.aiModelService\.getProviderConfig/);
    assert.doesNotMatch(aiServiceSource, /this\.aiModelService\.getProviderAdapter\(/);
});

test("town AI parses model JSON through the extension SDK helper", () => {
    assert.match(aiServiceSource, /safeJsonParse/);
    assert.doesNotMatch(aiServiceSource, /JSON\.parse\(match\?\.\[0\] \?\? text\)/);
});

test("town console model list uses the extension SDK instead of a direct AiModel repository", () => {
    const moduleSource = readFileSync(new URL("../src/api/modules/town/town.module.ts", import.meta.url), "utf8");

    assert.match(aiServiceSource, /this\.aiModelService\.listActiveLlmModels\(\)/);
    assert.equal(aiServiceSource.includes("@InjectRepository(AiModel)"), false);
    assert.equal(aiServiceSource.includes("aiModelRepo"), false);
    assert.equal(moduleSource.includes("AiModel"), false);
});
