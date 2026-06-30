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
const ASTROLOGY_API_INDEX_FILE = new URL("../src/api/index.ts", import.meta.url);
const ASTROLOGY_MODULE_FILE = new URL("../src/api/modules/astrology-fortune/astrology-fortune.module.ts", import.meta.url);
const ASTROLOGY_SERVICES_INDEX_FILE = new URL("../src/api/modules/astrology-fortune/services/index.ts", import.meta.url);
const ASTROLOGY_WEB_SERVICE_BASE_FILE = new URL("../src/web/services/base.ts", import.meta.url);
const ASTROLOGY_WEB_CONTROLLER_FILE = new URL("../src/api/modules/astrology-fortune/controllers/web/astrology-fortune.web.controller.ts", import.meta.url);

test("astrology manifest declares direct runtime imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@nestjs/common", "@nestjs/common is directly imported by API modules"],
        ["sonner", "sonner is directly imported by web pages"],
    ]);
});

test("astrology report generation uses the extension SDK rate limiter", async () => {
    const [pkgSource, moduleSource, controllerSource] = await Promise.all([
        readFile(PACKAGE_FILE, "utf8"),
        readFile(ASTROLOGY_MODULE_FILE, "utf8"),
        readFile(ASTROLOGY_WEB_CONTROLLER_FILE, "utf8"),
    ]);
    const pkg = JSON.parse(pkgSource);

    assert.equal(pkg.dependencies["@buildingai/cache"], "workspace:*");
    assert.match(moduleSource, /RedisModule/);
    assert.match(moduleSource, /provide:\s*ExtensionRateLimitService/);
    assert.match(moduleSource, /new ExtensionRateLimitService\(redisService\)/);
    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace:\s*"echoflow-astrology-fortune"/);
    assert.match(controllerSource, /assertRateLimit\("report-generation", user\.id\)/);
    assert.match(controllerSource, /suffix:\s*"short"[\s\S]*ttlSeconds:\s*10[\s\S]*limit:\s*5/);
    assert.match(controllerSource, /suffix:\s*"minute"[\s\S]*ttlSeconds:\s*60[\s\S]*limit:\s*20/);
});

test("astrology manifest does not keep unused template dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/utils", "@buildingai/web-types"]);
});

test("astrology publish build avoids nested pnpm script calls", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const publishScript = pkg.scripts?.["build:publish"] ?? "";

    assert.doesNotMatch(publishScript, /\bpnpm\b/);
    assert.match(publishScript, /rimraf build/);
    assert.match(publishScript, /vite build/);
    assert.match(publishScript, /tsup/);
});

test("astrology keeps thin service entrypoints required by build and imports", async () => {
    const [apiIndex, apiServicesIndex, webServiceBase] = await Promise.all([
        readFile(ASTROLOGY_API_INDEX_FILE, "utf8"),
        readFile(ASTROLOGY_SERVICES_INDEX_FILE, "utf8"),
        readFile(ASTROLOGY_WEB_SERVICE_BASE_FILE, "utf8"),
    ]);

    assert.match(apiIndex, /export\s+\*\s+from\s+["']\.\/modules\/app\.module["']/);
    assert.match(apiServicesIndex, /export\s+\*\s+from\s+["']\.\/astrology-fortune\.service["']/);
    assert.match(webServiceBase, /createPluginHttpClients/);
    assert.match(webServiceBase, /apiHttpClient/);
    assert.match(webServiceBase, /consoleHttpClient/);
});
