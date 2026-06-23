import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_SERVICE = new URL("src/modules/ai/services/ai-model.service.ts", ROOT);
const DIST_SERVICE_DTS = new URL("dist/modules/ai/services/ai-model.service.d.ts", ROOT);
const DIST_SERVICE_JS = new URL("dist/modules/ai/services/ai-model.service.js", ROOT);

test("PublicAiModelService exposes a high-level text generation entrypoint", async () => {
    const [src, distDts, distJs] = await Promise.all([
        readFile(SRC_SERVICE, "utf8"),
        readFile(DIST_SERVICE_DTS, "utf8"),
        readFile(DIST_SERVICE_JS, "utf8"),
    ]);

    assert.match(src, /generateText\(/);
    assert.match(src, /generateTextWithUsage/);
    assert.match(src, /normalizeProviderConfig/);
    assert.match(src, /supports\("language"\)/);
    assert.match(distDts, /generateText\(/);
    assert.match(distJs, /prototype\.generateText\s*=/);
    assert.match(distJs, /generateTextWithUsage/);
});
