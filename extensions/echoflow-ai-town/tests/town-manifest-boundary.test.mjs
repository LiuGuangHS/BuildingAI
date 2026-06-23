import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

import {
    assertAbsentDeps,
    assertDeclaredDeps,
    mergePackageDeps,
} from "../../test-utils/manifest-boundary.mjs";

const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const AI_USAGE_STORAGE_FILE = new URL("../src/web/lib/ai-usage-storage.ts", import.meta.url);
const AI_SERVICE_FILE = new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url);
const TOWN_MODULE_FILE = new URL("../src/api/modules/town/town.module.ts", import.meta.url);
const TOWN_WEB_CONTROLLER_FILE = new URL("../src/api/modules/town/controllers/web/town.web.controller.ts", import.meta.url);
const TSUP_CONFIG_FILE = new URL("../tsup.config.ts", import.meta.url);
const BUILD_TOWN_AI_RULES_FILE = new URL("../build/modules/town/services/town-ai-rules.mjs", import.meta.url);
const README_FILE = new URL("../README.md", import.meta.url);

test("town manifest declares direct browser storage helper imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@buildingai/stores", "@buildingai/stores is directly imported by browser persistence helpers"],
        ["eslint", "eslint/config is directly imported by eslint.config.mjs"],
        ["globals", "globals is directly imported by eslint.config.mjs"],
        ["tsup", "tsup is directly used by api build scripts"],
        ["ts-node", "ts-node/register/transpile-only is directly required by tests/town-play-loop-smoke.test.mjs"],
    ]);
});

test("town action and chat web endpoints use the extension SDK rate limiter", async () => {
    const [pkgSource, moduleSource, controllerSource] = await Promise.all([
        readFile(PACKAGE_FILE, "utf8"),
        readFile(TOWN_MODULE_FILE, "utf8"),
        readFile(TOWN_WEB_CONTROLLER_FILE, "utf8"),
    ]);
    const pkg = JSON.parse(pkgSource);

    assert.equal(pkg.dependencies["@buildingai/cache"], "workspace:*");
    assert.match(moduleSource, /RedisModule/);
    assert.match(moduleSource, /provide:\s*ExtensionRateLimitService/);
    assert.match(moduleSource, /new ExtensionRateLimitService\(redisService\)/);
    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace:\s*"echoflow-ai-town"/);
    assert.match(controllerSource, /assertRateLimit\("town-action", user\.id\)/);
    assert.match(controllerSource, /assertRateLimit\("town-chat", user\.id\)/);
    assert.match(controllerSource, /suffix:\s*"short"[\s\S]*ttlSeconds:\s*10[\s\S]*limit:\s*5/);
    assert.match(controllerSource, /suffix:\s*"minute"[\s\S]*ttlSeconds:\s*60[\s\S]*limit:\s*20/);
});

test("town manifest does not keep unused template dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/errors", "@buildingai/utils", "@buildingai/web-types"]);
});

test("town browser persistence reuses main storage exports", async () => {
    const source = await readFile(AI_USAGE_STORAGE_FILE, "utf8");

    assert.match(source, /@buildingai\/stores/);
    assert.match(source, /getLocalStorage/);
    assert.doesNotMatch(source, /window\.localStorage/);
});

test("town README documents the public AI service boundary instead of direct provider config normalization", async () => {
    const serviceSource = await readFile(AI_SERVICE_FILE, "utf8");
    const readme = await readFile(README_FILE, "utf8");

    assert.match(serviceSource, /PublicAiModelService/);
    assert.match(serviceSource, /this\.aiModelService\.generateText\(/);
    assert.doesNotMatch(serviceSource, /normalizeProviderConfig/);
    assert.match(readme, /PublicAiModelService/);
    assert.match(readme, /generateText\(\)/);
    assert.match(readme, /主系统边界内复用 `normalizeProviderConfig\(\)`/);
    assert.doesNotMatch(readme, /使用 `@buildingai\/extension-sdk` 的 `normalizeProviderConfig\(\)`/);
});

test("town api build copies mjs rule assets required by runtime imports", async () => {
    const source = await readFile(TSUP_CONFIG_FILE, "utf8");

    assert.match(source, /assets/);
    assert.match(source, /modules\/town\/services\/town-ai-rules\.mjs/);
    await readFile(BUILD_TOWN_AI_RULES_FILE, "utf8");
});
