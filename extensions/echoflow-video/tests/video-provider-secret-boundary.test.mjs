import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/generation/services/provider-config.service.ts", import.meta.url),
    "utf8",
);
const sdkSourceEntry = readFileSync(
    new URL("../../../packages/@buildingai/extension-sdk/src/index.ts", import.meta.url),
    "utf8",
);
const sdkDistEntry = readFileSync(
    new URL("../../../packages/@buildingai/extension-sdk/dist/index.d.ts", import.meta.url),
    "utf8",
);
const sdkDistProviderConfig = readFileSync(
    new URL("../../../packages/@buildingai/extension-sdk/dist/modules/ai/provider-config.d.ts", import.meta.url),
    "utf8",
);

test("video webhook Secret resolution uses the extension SDK provider secret helper", () => {
    assert.match(serviceSource, /resolveProviderSecretValue/);
    assert.doesNotMatch(serviceSource, /normalizeProviderConfig/);
    assert.doesNotMatch(serviceSource, /getConfigKeyValuePairs\(secretId\)/);
});

test("provider secret helper is exported from source and dist entrypoints", () => {
    assert.match(sdkSourceEntry, /resolveProviderSecretValue/);
    assert.match(sdkDistEntry, /resolveProviderSecretValue/);
    assert.match(sdkDistProviderConfig, /resolveProviderSecretValue/);
    assert.match(sdkDistProviderConfig, /ProviderSecretValueOptions/);
});
