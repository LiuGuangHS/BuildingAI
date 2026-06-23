import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_SERVICE = new URL("src/modules/rate-limit/extension-rate-limit.service.ts", ROOT);
const DIST_SERVICE_DTS = new URL("dist/modules/rate-limit/extension-rate-limit.service.d.ts", ROOT);
const SRC_INDEX = new URL("src/index.ts", ROOT);
const DIST_INDEX_DTS = new URL("dist/index.d.ts", ROOT);

test("ExtensionRateLimitService provides a Redis fixed-window limiter", async () => {
    const [src, distDts, srcIndex, distIndex] = await Promise.all([
        readFile(SRC_SERVICE, "utf8"),
        readFile(DIST_SERVICE_DTS, "utf8"),
        readFile(SRC_INDEX, "utf8"),
        readFile(DIST_INDEX_DTS, "utf8"),
    ]);

    assert.match(src, /class ExtensionRateLimitService/);
    assert.match(src, /interface ExtensionRateLimitRedisPort/);
    assert.match(src, /async assertAllowed/);
    assert.match(src, /redisService\.incr/);
    assert.match(src, /redisService\.expire/);
    assert.match(src, /HttpErrorFactory\.tooManyRequests/);
    assert.doesNotMatch(src, /@buildingai\/cache/);
    assert.match(distDts, /class ExtensionRateLimitService/);
    assert.doesNotMatch(distDts, /@buildingai\/cache/);
    assert.match(srcIndex, /ExtensionRateLimitService/);
    assert.match(distIndex, /ExtensionRateLimitService/);
});

test("ExtensionRateLimitService preserves the video generation limiter policy", async () => {
    const src = await readFile(SRC_SERVICE, "utf8");

    assert.match(src, /failOpen/);
    assert.match(src, /retryAfterSeconds/);
    assert.match(src, /namespace: string/);
    assert.match(src, /windows: ExtensionRateLimitWindow\[\]/);
});
