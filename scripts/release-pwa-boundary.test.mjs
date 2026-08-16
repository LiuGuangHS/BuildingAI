import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RELEASE = new URL("./release.mjs", import.meta.url);

test("release fingerprints the service worker cache after copying web assets", async () => {
    const source = await readFile(RELEASE, "utf8");

    assert.match(source, /sw\.js/);
    assert.match(source, /__BUILD_VERSION__/);
    assert.match(source, /createHash/);
    assert.match(source, /distPath/);
});
