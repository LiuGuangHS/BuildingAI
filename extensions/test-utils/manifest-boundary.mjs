import assert from "node:assert/strict";

export function mergePackageDeps(pkg) {
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

export function assertDeclaredDeps(deps, entries) {
    for (const [name, reason] of entries) {
        assert.ok(deps[name], reason);
    }
}

export function assertAbsentDeps(deps, names) {
    for (const name of names) {
        assert.equal(deps[name], undefined, `${name} should not be declared`);
    }
}
