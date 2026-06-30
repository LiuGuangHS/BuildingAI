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

test("web generation params and public templates do not expose model or console-only template fields", () => {
    const paramsMatch = source.match(/export type GenerateContractParams = \{([\s\S]*?)\n\};/);
    assert.ok(paramsMatch, "GenerateContractParams type should exist");
    assert.equal(/\bmodelId\b/.test(paramsMatch[1]), false);

    const templateMatch = source.match(/export type PublicContractTemplate = \{([\s\S]*?)\n\};/);
    assert.ok(templateMatch, "PublicContractTemplate type should exist");
    const templateBlock = templateMatch[1];
    assert.equal(/\bpromptTemplate\b/.test(templateBlock), false);
    assert.equal(/\bisActive\b/.test(templateBlock), false);
    assert.equal(/\bsortOrder\b/.test(templateBlock), false);
});

test("console-only task type carries admin troubleshooting fields separately", () => {
    assert.ok(source.includes("export type AdminContractGenerationTask = ContractGenerationTask &"));
    assert.ok(source.includes("userId: string"));
    assert.ok(source.includes("requestPayload?: Record<string, unknown> | null"));
});

test("contract risk findings support optional annotation anchors without exposing internals", () => {
    const match = source.match(/export type ContractRiskFinding = \{([\s\S]*?)\n\};/);
    assert.ok(match, "ContractRiskFinding type should exist");
    const riskBlock = match[1];
    for (const field of ["id?: string", "sectionId?: string", "kind?:", "missing_fact", "quote?: string"]) {
        assert.ok(riskBlock.includes(field), `${field} should remain optional`);
    }
    for (const forbidden of ["provider", "requestPayload", "modelId"]) {
        assert.equal(new RegExp(`\\b${forbidden}\\b`).test(riskBlock), false);
    }
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
