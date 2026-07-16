import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    "utf8",
);

test("image generation delegates provider requests to the platform AI model service", () => {
    assert.match(source, /PublicAiModelService/);
    assert.match(source, /aiModelService\.generateImage\(modelConfig\.mainModelId/);
    assert.doesNotMatch(source, /OpenAIImageClient/);
    assert.doesNotMatch(source, /openai-image-client/);
});
