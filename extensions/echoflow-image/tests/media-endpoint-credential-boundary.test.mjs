import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/model-config.service.ts", import.meta.url),
];

test("media model configs reuse main-site models instead of endpoint credentials", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /PublicAiModelService/);
        assert.match(source, /listActive(?:Image|Video)Models/);
        assert.doesNotMatch(source, /resolveProviderEndpointCredential/);
        assert.doesNotMatch(source, /getConfigKeyValuePairs/);
        assert.doesNotMatch(source, /secretId/);
    }
});

test("image generation uses the selected main-site model id", () => {
    const source = readFileSync(
        new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /aiModelService\.generateImage\(modelConfig\.mainModelId/);
    assert.doesNotMatch(source, /openai-image-client/);
});
