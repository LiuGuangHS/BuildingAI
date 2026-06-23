import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_CLIENT = new URL("src/utils/provider-http-client.ts", ROOT);
const DIST_CLIENT_DTS = new URL("dist/utils/provider-http-client.d.ts", ROOT);
const DIST_CLIENT_JS = new URL("dist/utils/provider-http-client.js", ROOT);
const SRC_INDEX = new URL("src/index.ts", ROOT);
const DIST_INDEX_DTS = new URL("dist/index.d.ts", ROOT);
const DIST_INDEX_JS = new URL("dist/index.js", ROOT);

const REQUIRED_EXPORTS = [
    "requestProviderText",
    "requestProviderJson",
    "testProviderJsonEndpoint",
    "safeJsonParse",
    "ProviderHttpError",
    "ProviderHttpRequestOptions",
];

test("provider HTTP client is exposed through the extension SDK", async () => {
    const [srcIndex, distDts, distJs] = await Promise.all([
        readFile(SRC_INDEX, "utf8"),
        readFile(DIST_INDEX_DTS, "utf8"),
        readFile(DIST_INDEX_JS, "utf8"),
    ]);

    for (const exportName of REQUIRED_EXPORTS) {
        assert.match(srcIndex, new RegExp(`\\b${exportName}\\b`));
        assert.match(distDts, new RegExp(`\\b${exportName}\\b`));
    }
    assert.match(distJs, /provider-http-client/);
});

test("provider HTTP client centralizes timeout, retry and safe JSON parsing", async () => {
    const [srcClient, distClientDts, distClientJs] = await Promise.all([
        readFile(SRC_CLIENT, "utf8"),
        readFile(DIST_CLIENT_DTS, "utf8"),
        readFile(DIST_CLIENT_JS, "utf8"),
    ]);

    assert.match(srcClient, /AbortController/);
    assert.match(srcClient, /setTimeout/);
    assert.match(srcClient, /maxRetries/);
    assert.match(srcClient, /retryDelayMs/);
    assert.match(srcClient, /class ProviderHttpError/);
    assert.match(srcClient, /safeJsonParse/);
    assert.match(srcClient, /返回了无效 JSON/);
    assert.match(srcClient, /normalizePublicHttpUrl/);
    assert.match(distClientDts, /requestProviderJson/);
    assert.match(distClientDts, /requestProviderText/);
    assert.match(distClientJs, /ProviderHttpError/);
    await Promise.all([access(DIST_CLIENT_DTS), access(DIST_CLIENT_JS)]);
});
