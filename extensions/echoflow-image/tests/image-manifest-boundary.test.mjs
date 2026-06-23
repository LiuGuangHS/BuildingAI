import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    assertAbsentDeps,
    assertDeclaredDeps,
    mergePackageDeps,
} from "../../test-utils/manifest-boundary.mjs";

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
