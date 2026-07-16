import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProviderConfig } from "../dist/modules/ai/provider-config.js";

test("normalizeProviderConfig supports BaseURL-only providers", () => {
    assert.deepEqual(
        normalizeProviderConfig({
            base_url: { value: "http://localhost:11434/v1", required: true },
        }),
        {
            apiKey: "",
            baseURL: "http://localhost:11434/v1",
            apiMode: undefined,
            webhookSecret: "",
        },
    );
});

test("normalizeProviderConfig keeps aliases and explicit API mode", () => {
    assert.deepEqual(
        normalizeProviderConfig({
            api_key: { value: "key", required: true },
            baseUrl: { value: "https://api.example.com/v1", required: false },
            api_mode: { value: "responses", required: false },
        }),
        {
            apiKey: "key",
            baseURL: "https://api.example.com/v1",
            apiMode: "responses",
            webhookSecret: "",
        },
    );
});
