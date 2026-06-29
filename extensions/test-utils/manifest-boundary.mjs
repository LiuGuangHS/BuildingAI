import assert from "node:assert/strict";

export function mergePackageDeps(pkg) {
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
}

export function assertDeclaredDeps(deps, entries) {
    for (const [name, message] of entries) {
        assert.ok(deps[name], message ?? `expected dependency ${name}`);
    }
}

export function assertAbsentDeps(deps, names) {
    for (const name of names) {
        assert.equal(deps[name], undefined, `${name} should not be declared`);
    }
}
