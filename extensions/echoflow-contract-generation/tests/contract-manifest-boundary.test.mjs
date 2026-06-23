import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

import {
    assertAbsentDeps,
    assertDeclaredDeps,
    mergePackageDeps,
} from "../../test-utils/manifest-boundary.mjs";

const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const CONTRACT_MODULE_FILE = new URL("../src/api/modules/contract-generation/contract-generation.module.ts", import.meta.url);
const CONTRACT_WEB_CONTROLLER_FILE = new URL("../src/api/modules/contract-generation/controllers/web/contract-generation.web.controller.ts", import.meta.url);
const CONTRACT_SERVICE_FILE = new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url);

test("contract manifest declares direct runtime imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@nestjs/common", "@nestjs/common is directly imported by API modules"],
        ["eslint", "eslint/config is directly imported by eslint.config.mjs"],
        ["express", "express Request is directly imported by API modules"],
        ["globals", "globals is directly imported by eslint.config.mjs"],
    ]);
});

test("contract manifest does not keep unused template dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/utils", "@buildingai/web-types"]);
});

test("contract high-cost web actions use the extension SDK rate limiter", async () => {
    const [pkgSource, moduleSource, controllerSource] = await Promise.all([
        readFile(PACKAGE_FILE, "utf8"),
        readFile(CONTRACT_MODULE_FILE, "utf8"),
        readFile(CONTRACT_WEB_CONTROLLER_FILE, "utf8"),
    ]);
    const pkg = JSON.parse(pkgSource);

    assert.equal(pkg.dependencies["@buildingai/cache"], "workspace:*");
    assert.match(moduleSource, /RedisModule/);
    assert.match(moduleSource, /provide:\s*ExtensionRateLimitService/);
    assert.match(moduleSource, /new ExtensionRateLimitService\(redisService\)/);
    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace:\s*"echoflow-contract-generation"/);
    for (const action of ["generate", "review-upload", "review-task", "rewrite-clause", "export"]) {
        assert.match(controllerSource, new RegExp(`assertRateLimit\\("${action}", user\\.id\\)`));
    }
    assert.match(controllerSource, /suffix:\s*"short"[\s\S]*ttlSeconds:\s*10[\s\S]*limit:\s*5/);
    assert.match(controllerSource, /suffix:\s*"minute"[\s\S]*ttlSeconds:\s*60[\s\S]*limit:\s*20/);
});

test("contract upload review uses main upload service boundary", async () => {
    const [moduleSource, serviceSource] = await Promise.all([
        readFile(CONTRACT_MODULE_FILE, "utf8"),
        readFile(CONTRACT_SERVICE_FILE, "utf8"),
    ]);

    assert.match(moduleSource, /UploadModule/, "contract module should import the main upload module");
    assert.doesNotMatch(moduleSource, /TypeOrmModule\.forFeature\(\[[^\]]*\bFile\b/s, "contract module should not register the platform File entity directly");
    assert.doesNotMatch(moduleSource, /StorageConfig/, "contract module should rely on UploadModule for storage config");
    assert.match(serviceSource, /FileUploadService/, "contract upload review should resolve files through the main upload service");
    assert.doesNotMatch(serviceSource, /@InjectRepository\(File\)/, "contract service should not inject the platform File repository directly");
    assert.doesNotMatch(serviceSource, /fileRepo/, "contract service should not keep a direct File repository field");
});
