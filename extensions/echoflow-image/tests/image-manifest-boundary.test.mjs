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

test("image manifest declares direct runtime imports", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertDeclaredDeps(deps, [
        ["@nestjs/common", "@nestjs/common is directly imported by API modules"],
        ["@buildingai/stores", "@buildingai/stores is directly imported by console JSON editors"],
        ["class-transformer", "class-transformer is directly imported by DTO modules"],
        ["class-validator", "class-validator is directly imported by DTO modules"],
        ["eslint", "eslint/config is directly imported by eslint.config.mjs"],
        ["eslint-plugin-react-hooks", "eslint.config.mjs enforces React Hook rules"],
        ["globals", "globals is directly imported by eslint.config.mjs"],
        ["tsup", "tsup Options is directly imported by tsup.config.ts"],
        ["vite", "vite build API is directly imported by scripts/build-web.mjs"],
    ]);
});

test("image manifest does not keep unused template dependencies", async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_FILE, "utf8"));
    const deps = mergePackageDeps(pkg);

    assertAbsentDeps(deps, ["@buildingai/utils"]);
});
