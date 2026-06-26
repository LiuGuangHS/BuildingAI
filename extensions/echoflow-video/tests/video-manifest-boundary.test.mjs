import { access, readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

import {
    assertAbsentDeps,
    assertDeclaredDeps,
    mergePackageDeps,
} from "../../test-utils/manifest-boundary.mjs";

const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const MANIFEST_FILE = new URL("../manifest.json", import.meta.url);
const EXTENSIONS_REGISTRY_FILE = new URL("../../extensions.json", import.meta.url);
const EXTENSION_CLI_FILE = new URL("../../../packages/cli/src/commands/extension.js", import.meta.url);
const EXTENSION_OPERATION_SERVICE_FILE = new URL(
    "../../../packages/api/src/modules/extension/services/extension-operation.service.ts",
    import.meta.url,
);
const OUTPUT_INDEX_FILE = new URL("../.output/public/index.html", import.meta.url);
const BUILD_INDEX_FILE = new URL("../build/index.js", import.meta.url);
const STORAGE_STATIC_DIR = new URL("../storage/static/", import.meta.url);
const STORAGE_DESIGN_DIR = new URL("../storage/static/design/", import.meta.url);
const README_FILE = new URL("../README.md", import.meta.url);
const GENERATION_MODULE_FILE = new URL("../src/api/modules/generation/generation.module.ts", import.meta.url);
const GENERATION_SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const MODEL_CONFIG_SERVICE_FILE = new URL("../src/api/modules/generation/services/model-config.service.ts", import.meta.url);
const LEGACY_HAPPYHORSE_CLIENT_FILE = new URL("../src/api/modules/generation/services/happyhorse-client.ts", import.meta.url);
const REUSE_PARAMS_STORAGE_FILE = new URL("../src/web/lib/reuse-params-storage.ts", import.meta.url);

test("video manifest declares direct runtime imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@tailwindcss/vite", "@tailwindcss/vite is directly imported by vite.config.ts"],
        ["@vitejs/plugin-react", "@vitejs/plugin-react is directly imported by vite.config.ts"],
        ["@playwright/test", "@playwright/test is directly imported by tests/e2e/video-plugin.spec.ts"],
        ["@buildingai/stores", "@buildingai/stores is directly imported by browser persistence helpers"],
        ["@nestjs/common", "@nestjs/common is directly imported by API modules"],
        ["class-transformer", "class-transformer is directly imported by DTO modules"],
        ["class-validator", "class-validator is directly imported by DTO modules"],
        ["eslint", "eslint/config is directly imported by eslint.config.mjs"],
        ["globals", "globals is directly imported by eslint.config.mjs"],
        ["tsup", "tsup Options is directly imported by tsup.config.ts"],
    ]);
});

test("video manifest, package, and local registry stay aligned", async () => {
    const [pkg, manifest, registry] = await Promise.all([
        readFile(PACKAGE_FILE, "utf8").then(JSON.parse),
        readFile(MANIFEST_FILE, "utf8").then(JSON.parse),
        readFile(EXTENSIONS_REGISTRY_FILE, "utf8").then(JSON.parse),
    ]);
    const registered = registry.applications?.["echoflow-video"]?.manifest;

    assert.equal(pkg.name, "echoflow-video");
    assert.equal(manifest.identifier, pkg.name);
    assert.equal(manifest.version, pkg.version);
    assert.equal(registered?.identifier, manifest.identifier);
    assert.equal(registered?.version, manifest.version);
    assert.equal(registered?.name, manifest.name);
});

test("video publish script and generated outputs include web, api, and static assets", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));

    assert.match(pkg.scripts?.["build:publish"] ?? "", /vite build/);
    assert.match(pkg.scripts?.["build:publish"] ?? "", /tsup/);
    await access(OUTPUT_INDEX_FILE);
    await access(BUILD_INDEX_FILE);
    await access(new URL("logo.png", STORAGE_STATIC_DIR));

    const designAssets = await readdir(STORAGE_DESIGN_DIR);
    assert.deepEqual(
        designAssets.sort(),
        [
            "video-workbench-material-flow.png",
            "video-workbench-mode-first.png",
            "video-workbench-result-led.png",
        ],
    );
});

test("video release boundary follows the extension CLI allowlist", async () => {
    const { RELEASE_COPY_ALLOWLIST } = await import(EXTENSION_CLI_FILE.href);

    assert.deepEqual(
        [
            ".output",
            "build",
            "src",
            "storage/static",
            "storage/.gitkeep",
            "manifest.json",
            "package.json",
            "README.md",
            "tsconfig.json",
            "tsconfig.web.json",
            "tsconfig.api.json",
            "tsup.config.ts",
            "eslint.config.mjs",
        ].filter((entry) => !RELEASE_COPY_ALLOWLIST.includes(entry)),
        [],
    );
    assert.equal(
        RELEASE_COPY_ALLOWLIST.includes("storage/uploads"),
        false,
        "release zip must not carry runtime upload results",
    );
    assert.equal(
        RELEASE_COPY_ALLOWLIST.includes("node_modules"),
        false,
        "release zip must not carry installed dependencies",
    );
    assert.equal(
        RELEASE_COPY_ALLOWLIST.includes("tests"),
        false,
        "release zip must not carry test-only files",
    );
});

test("video install smoke plan matches platform upgrade preservation", async () => {
    const source = await readFile(EXTENSION_OPERATION_SERVICE_FILE, "utf8");

    assert.match(source, /const preservePaths = \["data", "storage"\]/);
    assert.match(source, /fs\.copy\(backupPath, targetPath, \{ overwrite: false \}\)/);
    assert.match(source, /storage\/node_modules/);
});

test("video manifest does not keep unused template dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/utils"]);
});

test("video media validation uses main upload service boundary", async () => {
    const [moduleSource, serviceSource] = await Promise.all([
        readFile(GENERATION_MODULE_FILE, "utf8"),
        readFile(GENERATION_SERVICE_FILE, "utf8"),
    ]);

    assert.match(moduleSource, /UploadModule/, "generation module should import the main upload module");
    assert.match(serviceSource, /FileUploadService/, "media metadata should be resolved through the main upload service");
    assert.doesNotMatch(serviceSource, /@InjectRepository\(File\)/, "plugin code should not inject the platform File repository directly");
    assert.doesNotMatch(serviceSource, /fileRepository/, "plugin code should not keep a direct File repository field");
});

test("video removes the legacy HappyHorse-only client from the active protocol layer", async () => {
    const [modelConfigSource, readmeSource] = await Promise.all([
        readFile(MODEL_CONFIG_SERVICE_FILE, "utf8"),
        readFile(README_FILE, "utf8"),
    ]);

    await assert.rejects(
        access(LEGACY_HAPPYHORSE_CLIENT_FILE),
        /ENOENT/,
        "the generic VideoGatewayClient should own active provider protocol calls",
    );
    assert.doesNotMatch(modelConfigSource, /happyhorse-client/);
    assert.doesNotMatch(modelConfigSource, /defaultHappyHorseClientOptions/);
    assert.doesNotMatch(readmeSource, /HappyHorseClient/);
});

test("video reuse params storage reuses main storage exports", async () => {
    const source = await readFile(REUSE_PARAMS_STORAGE_FILE, "utf8");

    assert.match(source, /@buildingai\/stores/);
    assert.match(source, /getSessionStorage/);
    assert.match(source, /safeJsonParse/);
    assert.match(source, /safeJsonStringify/);
    assert.doesNotMatch(source, /window\.sessionStorage/);
    assert.doesNotMatch(source, /JSON\.parse/);
    assert.doesNotMatch(source, /JSON\.stringify/);
});
