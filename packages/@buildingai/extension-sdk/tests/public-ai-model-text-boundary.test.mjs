import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_INDEX = new URL("src/index.ts", ROOT);
const SRC_SERVICE = new URL("src/modules/ai/services/ai-model.service.ts", ROOT);

test("PublicAiModelService exposes a high-level text generation entrypoint", async () => {
    const [index, src] = await Promise.all([
        readFile(SRC_INDEX, "utf8"),
        readFile(SRC_SERVICE, "utf8"),
    ]);

    assert.match(index, /PublicAiModelService/);
    assert.match(src, /generateText\(/);
    assert.match(src, /generateTextWithUsage/);
    assert.match(src, /normalizeProviderConfig/);
    assert.match(src, /supports\("language"\)/);
});
