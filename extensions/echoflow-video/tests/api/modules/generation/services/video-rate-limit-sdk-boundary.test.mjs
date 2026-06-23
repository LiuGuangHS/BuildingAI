import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../../../");
const controllerSource = readFileSync(
    resolve(root, "src/api/modules/generation/controllers/web/generation.web.controller.ts"),
    "utf8",
);
const moduleSource = readFileSync(resolve(root, "src/api/modules/generation/generation.module.ts"), "utf8");

test("video web rate limits use the extension SDK limiter", () => {
    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace: "echoflow-video"/);
    assert.match(controllerSource, /suffix: "short"[\s\S]*ttlSeconds: 10[\s\S]*limit: 5/);
    assert.match(controllerSource, /suffix: "minute"[\s\S]*ttlSeconds: 60[\s\S]*limit: 20/);
    assert.match(moduleSource, /provide: ExtensionRateLimitService/);
    assert.match(moduleSource, /new ExtensionRateLimitService\(redisService\)/);
    assert.doesNotMatch(controllerSource + moduleSource, /VideoRequestLimiterService/);
});
