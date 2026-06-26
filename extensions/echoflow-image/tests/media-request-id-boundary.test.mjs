import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const imageFormFile = new URL("../src/web/components/generation-form.tsx", import.meta.url);

const mediaFormFiles = [
    imageFormFile,
    new URL("../../echoflow-video/src/web/components/generation-form.tsx", import.meta.url),
];

const deletedPluginHelpers = [
    new URL("../src/web/lib/request-key.ts", import.meta.url),
    new URL("../../echoflow-video/src/web/lib/request-key.ts", import.meta.url),
];

test("image generation form uses browser UUID request ids", async () => {
    const source = await readFile(imageFormFile, "utf8");
    assert.match(source, /\bcrypto\.randomUUID\(\)/);
});

test("media generation forms do not keep local request-key helpers", async () => {
    for (const file of mediaFormFiles) {
        const source = await readFile(file, "utf8");

        assert.doesNotMatch(source, /createRequestKey/);
        assert.doesNotMatch(source, /request-key/);
    }
});

test("media plugins no longer keep local request-key helpers", async () => {
    for (const file of deletedPluginHelpers) {
        await assert.rejects(access(file));
    }
});
