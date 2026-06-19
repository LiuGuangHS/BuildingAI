import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const formFiles = [
    new URL("../src/web/components/generation-form.tsx", import.meta.url),
    new URL("../../echoflow-video/src/web/components/generation-form.tsx", import.meta.url),
];

const deletedPluginHelpers = [
    new URL("../src/web/lib/request-key.ts", import.meta.url),
    new URL("../../echoflow-video/src/web/lib/request-key.ts", import.meta.url),
];

test("media generation forms reuse main-system request id helper", async () => {
    for (const file of formFiles) {
        const source = await readFile(file, "utf8");

        assert.match(source, /@buildingai\/http/);
        assert.match(source, /\bcreateRequestId\b/);
        assert.doesNotMatch(source, /createRequestKey/);
        assert.doesNotMatch(source, /request-key/);
    }
});

test("media plugins no longer keep local request-key helpers", async () => {
    for (const file of deletedPluginHelpers) {
        await assert.rejects(access(file));
    }
});
