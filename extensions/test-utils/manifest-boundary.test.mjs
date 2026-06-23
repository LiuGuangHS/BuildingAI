import test from "node:test";
import assert from "node:assert/strict";

import {
    assertAbsentDeps,
    assertDeclaredDeps,
    mergePackageDeps,
} from "./manifest-boundary.mjs";

test("manifest boundary helper merges runtime and dev dependencies", () => {
    const deps = mergePackageDeps({
        dependencies: { react: "catalog:web" },
        devDependencies: { "@types/react": "catalog:web" },
    });

    assert.deepEqual(deps, {
        react: "catalog:web",
        "@types/react": "catalog:web",
    });
});

test("manifest boundary helper checks required and forbidden dependencies", () => {
    const deps = { react: "catalog:web" };

    assertDeclaredDeps(deps, [["react", "react is directly imported"]]);
    assert.throws(() => assertDeclaredDeps(deps, [["missing", "missing is required"]]), /missing is required/);
    assertAbsentDeps(deps, ["unused"]);
    assert.throws(() => assertAbsentDeps(deps, ["react"]), /react/);
});
