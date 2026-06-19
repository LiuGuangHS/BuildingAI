import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
    new URL("../src/web/services/types/contract-generation.ts", import.meta.url),
    "utf8",
);
const webServiceSource = readFileSync(
    new URL("../src/web/services/web/contract-generation.ts", import.meta.url),
    "utf8",
);
const consoleServiceSource = readFileSync(
    new URL("../src/web/services/console/contract-generation.ts", import.meta.url),
    "utf8",
);

test("web public contract task type does not expose host, provider, or raw request fields", () => {
    const match = source.match(/export type ContractGenerationTask = \{([\s\S]*?)\n\};/);
    assert.ok(match, "ContractGenerationTask type should exist");
    const taskBlock = match[1];
    assert.equal(/\buserId\b/.test(taskBlock), false);
    assert.equal(/\bmodelId\b/.test(taskBlock), false);
    assert.equal(/\bproviderId\b/.test(taskBlock), false);
    assert.equal(/\brequestPayload\b/.test(taskBlock), false);
});

test("console-only task type carries admin troubleshooting fields separately", () => {
    assert.ok(source.includes("export type AdminContractGenerationTask = ContractGenerationTask &"));
    assert.ok(source.includes("userId: string"));
    assert.ok(source.includes("requestPayload?: Record<string, unknown> | null"));
});

test("web and console services use the matching task types and clients", () => {
    assert.match(webServiceSource, /apiHttpClient/);
    assert.doesNotMatch(webServiceSource, /consoleHttpClient/);
    assert.match(webServiceSource, /ContractGenerationTask/);
    assert.doesNotMatch(webServiceSource, /AdminContractGenerationTask/);

    assert.match(consoleServiceSource, /consoleHttpClient/);
    assert.doesNotMatch(consoleServiceSource, /apiHttpClient/);
    assert.match(consoleServiceSource, /AdminContractGenerationTask/);
});
