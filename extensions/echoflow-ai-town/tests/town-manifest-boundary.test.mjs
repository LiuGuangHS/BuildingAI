import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

function mergePackageDeps(pkg) {
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
}

function assertDeclaredDeps(deps, entries) {
    for (const [name, message] of entries) {
        assert.ok(deps[name], message ?? `expected dependency ${name}`);
    }
}

function assertAbsentDeps(deps, names) {
    for (const name of names) {
        assert.equal(deps[name], undefined, `${name} should not be declared`);
    }
}

const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const AI_SERVICE_FILE = new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url);
const TOWN_MODULE_FILE = new URL("../src/api/modules/town/town.module.ts", import.meta.url);
const TOWN_WEB_CONTROLLER_FILE = new URL("../src/api/modules/town/controllers/web/town.web.controller.ts", import.meta.url);
const TSUP_CONFIG_FILE = new URL("../tsup.config.ts", import.meta.url);

test("town manifest declares direct build and test imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@buildingai/base", "@buildingai/base is directly imported by base service/controller classes"],
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

test("town manifest does not keep unused template or persistence dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/errors", "@buildingai/stores", "@buildingai/utils", "@buildingai/web-types"]);
});

test("town AI service uses public model service instead of direct provider config normalization", async () => {
    const serviceSource = await readFile(AI_SERVICE_FILE, "utf8");

    assert.match(serviceSource, /PublicAiModelService/);
    assert.match(serviceSource, /this\.aiModelService\.generateText\(/);
    assert.doesNotMatch(serviceSource, /normalizeProviderConfig/);
});

test("town api build config declares runtime mjs rule assets", async () => {
    const source = await readFile(TSUP_CONFIG_FILE, "utf8");

    assert.match(source, /assets/);
    assert.match(source, /modules\/town\/services\/town-ai-rules\.mjs/);
});
