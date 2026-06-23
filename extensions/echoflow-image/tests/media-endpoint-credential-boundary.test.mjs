import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/model-config.service.ts", import.meta.url),
];

test("image model config keeps the provider default base URL in the model catalog", () => {
    const serviceSource = readFileSync(files[0], "utf8");
    const clientSource = readFileSync(new URL("../src/api/modules/generation/services/openai-image-client.ts", import.meta.url), "utf8");
    const catalogSource = readFileSync(new URL("../src/api/modules/config/services/image-model-catalog.ts", import.meta.url), "utf8");

    assert.match(catalogSource, /export const DEFAULT_IMAGE_GATEWAY_BASE_URL = "https:\/\/api\.openai\.com\/v1";/);
    assert.match(serviceSource, /DEFAULT_IMAGE_GATEWAY_BASE_URL/);
    assert.match(clientSource, /DEFAULT_IMAGE_GATEWAY_BASE_URL/);
    assert.doesNotMatch(serviceSource, /defaultBaseUrl:\s*"https:\/\/api\.openai\.com\/v1"/);
    assert.doesNotMatch(clientSource, /"https:\/\/api\.openai\.com\/v1"/);
});

test("media model config services resolve endpoint credentials through the extension SDK", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /resolveProviderEndpointCredential/);
        assert.doesNotMatch(source, /normalizeProviderConfig/);
        assert.doesNotMatch(source, /getConfigKeyValuePairs\(endpoint\.secretId\)/);
    }
});

test("endpoint credential helper is exported from source and dist entrypoints", () => {
    const sourceEntry = readFileSync(new URL("../../../packages/@buildingai/extension-sdk/src/index.ts", import.meta.url), "utf8");
    const distEntry = readFileSync(new URL("../../../packages/@buildingai/extension-sdk/dist/index.d.ts", import.meta.url), "utf8");

    assert.match(sourceEntry, /resolveProviderEndpointCredential/);
    assert.match(distEntry, /resolveProviderEndpointCredential/);
});
