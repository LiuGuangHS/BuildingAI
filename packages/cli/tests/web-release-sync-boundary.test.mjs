import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const PREDEPLOY = new URL("bin/predeploy.js", ROOT);
const UPDATE = new URL("src/commands/update.js", ROOT);

const RELEASE_PATTERN = /await executeCommand\("node", \["scripts\/release\.mjs"\], \{ cwd: rootDir \}\);/g;
const UPDATE_BUILD_AND_RELEASE = /await executeCommand\("pnpm", \["build"\], \{ cwd: rootDir \}\);\s*await executeCommand\("node", \["scripts\/release\.mjs"\], \{ cwd: rootDir \}\);/g;

function countReleaseCalls(source) {
    return [...source.matchAll(RELEASE_PATTERN)].length;
}

test("predeploy refreshes public web assets after the project build", async () => {
    const source = await readFile(PREDEPLOY, "utf8");

    assert.equal(countReleaseCalls(source), 1);
});

test("both update flows refresh public web assets after the project build", async () => {
    const source = await readFile(UPDATE, "utf8");

    assert.equal(countReleaseCalls(source), 2);
    assert.equal([...source.matchAll(UPDATE_BUILD_AND_RELEASE)].length, 2);
});
