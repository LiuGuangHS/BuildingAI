import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    new URL("../src/api/modules/generation/services/image-http-client.ts", import.meta.url),
    new URL("../../echoflow-contract-generation/src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/generation.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/model-config.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/video-http-client.ts", import.meta.url),
];

test("media model endpoints reuse extension-sdk public HTTP URL guards", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /@buildingai\/extension-sdk/);
        assert.doesNotMatch(source, /function\s+isPrivateOrLocalHost\b/);
        assert.doesNotMatch(source, /private\s+isPrivateOrLocalHost\b/);
        assert.doesNotMatch(source, /function\s+isPrivateOrReservedIp\b/);
        assert.doesNotMatch(source, /function\s+isPrivateOrReservedIpv4\b/);
        assert.doesNotMatch(source, /isIP\(/);
        assert.doesNotMatch(source, /node:net/);
        assert.doesNotMatch(source, /node:dns\/promises/);
    }
});

test("media model config uses main-site models instead of persisting provider endpoints", () => {
    for (const file of files.filter((item) => item.pathname.includes("model-config.service.ts"))) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /PublicAiModelService/);
        assert.doesNotMatch(source, /normalizeEndpointConfigsForSave/);
        assert.doesNotMatch(source, /resolveProviderEndpointCredential/);
    }
});

test("media provider HTTP requests reuse the extension SDK provider client", () => {
    const imageHttpClient = readFileSync(
        new URL("../src/api/modules/generation/services/image-http-client.ts", import.meta.url),
        "utf8",
    );
    const imageGenerationService = readFileSync(
        new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
        "utf8",
    );
    const videoHttpClient = readFileSync(
        new URL("../../echoflow-video/src/api/modules/generation/services/video-http-client.ts", import.meta.url),
        "utf8",
    );

    assert.match(imageHttpClient, /requestProviderText/);
    assert.match(imageHttpClient, /safeJsonParse/);
    assert.match(imageGenerationService, /safeJsonParse/);
    assert.match(imageGenerationService, /aiModelService\.generateImage\(modelConfig\.mainModelId/);
    assert.doesNotMatch(imageGenerationService, /JSON\.parse\(text\)/);
    assert.match(videoHttpClient, /requestProviderJson/);
    assert.match(videoHttpClient, /testProviderJsonEndpoint/);
    assert.doesNotMatch(videoHttpClient, /\bfetch\(/);
    assert.doesNotMatch(videoHttpClient, /function\s+sleep\b/);
});

test("image reference URL download reuses the extension SDK public HTTP downloader", () => {
    const imageHttpClient = readFileSync(
        new URL("../src/api/modules/generation/services/image-http-client.ts", import.meta.url),
        "utf8",
    );

    assert.match(imageHttpClient, /downloadPublicHttpUrl/);
    assert.doesNotMatch(imageHttpClient, /node:http/);
    assert.doesNotMatch(imageHttpClient, /node:https/);
    assert.doesNotMatch(imageHttpClient, /resolvePublicHttpUrl/);
    assert.doesNotMatch(imageHttpClient, /ResolvedPublicHttpUrl/);
    assert.doesNotMatch(imageHttpClient, /lookup:/);
});
