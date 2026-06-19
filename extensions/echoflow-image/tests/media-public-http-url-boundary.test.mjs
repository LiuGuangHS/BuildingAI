import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
    new URL("../src/api/modules/generation/services/image-http-client.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/model-config.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/video-http-client.ts", import.meta.url),
];

test("media model endpoints reuse extension-sdk public HTTP URL guards", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /@buildingai\/extension-sdk/);
        assert.doesNotMatch(source, /function\s+isPrivateOrLocalHost\b/);
        assert.doesNotMatch(source, /private\s+isPrivateOrLocalHost\b/);
    }
});

test("media endpoint persistence validates DNS-backed public Base URLs", () => {
    for (const file of files.filter((item) => item.pathname.includes("model-config.service.ts"))) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /assertPublicHttpUrl/);
        assert.match(source, /normalizeEndpointConfigsForSave/);
    }
});
