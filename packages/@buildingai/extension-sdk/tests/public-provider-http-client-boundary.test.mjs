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
    assert.match(srcClient, /assertPublicHttpUrl/);
    assert.match(srcClient, /redirect: "error"/);
    assert.match(distClientDts, /requestProviderJson/);
    assert.match(distClientDts, /requestProviderText/);
    assert.match(distClientJs, /ProviderHttpError/);
    await Promise.all([access(DIST_CLIENT_DTS), access(DIST_CLIENT_JS)]);
});

test("provider writes retry only with an explicit idempotency key", async () => {
    const { requestProviderText } = await import("../dist/utils/provider-http-client.js");
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    const sentKeys = [];

    globalThis.fetch = async (_url, options) => {
        attempts += 1;
        sentKeys.push(new Headers(options?.headers).get("Idempotency-Key"));
        return new Response("unavailable", { status: 503 });
    };

    try {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            attempts = 0;
            await assert.rejects(() =>
                requestProviderText("https://1.1.1.1/provider", {
                    method,
                    body: "{}",
                    retryDelayMs: 0,
                }),
            );
            assert.equal(attempts, 1);
        }

        attempts = 0;
        sentKeys.length = 0;
        await assert.rejects(() =>
            requestProviderText("https://1.1.1.1/provider", {
                method: "POST",
                body: "{}",
                idempotencyKey: "provider-request-1",
                retryDelayMs: 0,
            }),
        );
        assert.equal(attempts, 3);
        assert.deepEqual(sentKeys, ["provider-request-1", "provider-request-1", "provider-request-1"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("provider caps explicit retries", async () => {
    const { requestProviderText } = await import("../dist/utils/provider-http-client.js");
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        return new Response("unavailable", { status: 503 });
    };

    try {
        await assert.rejects(() =>
            requestProviderText("https://1.1.1.1/provider", {
                method: "GET",
                maxRetries: 3,
                retryDelayMs: 0,
            }),
        );
        assert.equal(attempts, 3);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("provider never retries authentication failures", async () => {
    const { requestProviderText } = await import("../dist/utils/provider-http-client.js");
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        return new Response("unauthorized", { status: 401 });
    };

    try {
        await assert.rejects(() =>
            requestProviderText("https://1.1.1.1/provider", {
                method: "GET",
                classifyError: () => new Error("retry"),
                isRetryableError: () => true,
                retryDelayMs: 0,
            }),
        );
        assert.equal(attempts, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("provider rejects conflicting idempotency keys before a request", async () => {
    const { requestProviderText } = await import("../dist/utils/provider-http-client.js");
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        return new Response("ok", { status: 200 });
    };

    try {
        await assert.rejects(() =>
            requestProviderText("https://1.1.1.1/provider", {
                method: "POST",
                headers: { "idempotency-key": "caller-key" },
                idempotencyKey: "provider-key",
            }),
        );
        assert.equal(attempts, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("provider reads retain bounded retry behavior", async () => {
    const { requestProviderText } = await import("../dist/utils/provider-http-client.js");
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        return new Response("unavailable", { status: 503 });
    };

    try {
        for (const method of ["GET", "HEAD", "OPTIONS"]) {
            attempts = 0;
            await assert.rejects(() =>
                requestProviderText("https://1.1.1.1/provider", {
                    method,
                    retryDelayMs: 0,
                }),
            );
            assert.equal(attempts, 3);
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
});
