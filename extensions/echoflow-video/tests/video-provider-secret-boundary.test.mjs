import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import test from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/generation/services/provider-config.service.ts", import.meta.url),
    "utf8",
);
const entitySource = readFileSync(
    new URL("../src/api/db/entities/video-provider-config.entity.ts", import.meta.url),
    "utf8",
);

test("video provider config keeps prompt optimizer only", () => {
    assert.match(serviceSource, /listActiveLlmModels/);
    assert.doesNotMatch(serviceSource, /resolveProviderSecretValue|normalizeProviderConfig|getConfigKeyValuePairs/);
    assert.doesNotMatch(serviceSource, /verifyHappyHorseWebhookSecret|webhookSecret/);
    assert.doesNotMatch(entitySource, /webhookSecret|webhook_secret|templates/);
});

test("legacy video webhook controller is not registered", () => {
    assert.throws(
        () => accessSync(new URL("../src/api/modules/generation/controllers/web/webhook.controller.ts", import.meta.url)),
        /ENOENT/,
    );
});
