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
const webControllerSource = readFileSync(
    new URL("../src/api/modules/contract-generation/controllers/web/contract-generation.web.controller.ts", import.meta.url),
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

test("public task and write request types carry revision without exposing internals", () => {
    const taskMatch = source.match(/export type ContractGenerationTask = \{([\s\S]*?)\n\};/);
    assert.ok(taskMatch, "ContractGenerationTask type should exist");
    assert.match(taskMatch[1], /revision: number/);

    for (const typeName of ["UpdateContractContentParams", "UpdateRiskActionParams", "RestoreContractVersionParams"]) {
        const match = source.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`));
        assert.ok(match, `${typeName} should exist`);
        assert.match(match[1], /baseRevision: number/);
    }
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

test("public task type does not expose result URLs or provider metadata", () => {
    const match = source.match(/export type ContractGenerationTask = \{([\s\S]*?)\n\};/);
    assert.ok(match, "ContractGenerationTask type should exist");
    assert.equal(/\\bresultUrl\\b/.test(match[1]), false);
    assert.equal(/providerMetadata/.test(match[1]), false);
    assert.match(match[1], /exportStatus:/);
});

test("upload review public and internal boundaries use fileId without fileUrl", () => {
    assert.doesNotMatch(webServiceSource, /resultUrl/);
    assert.doesNotMatch(webServiceSource, /fileUrl/);
});

test("web controller uses an explicit public task serializer without spreading the entity", () => {
    assert.match(webControllerSource, /toPublicTask/);
    assert.doesNotMatch(webControllerSource, /\.\.\.publicTask/);
    const serializer = webControllerSource.match(/private toPublicTask\(task: ContractGenerationTask\) \{([\s\S]*?)\n    \}\n\}/);
    assert.ok(serializer, "public task serializer should exist");
    assert.doesNotMatch(serializer[1], /resultUrl:/);
    assert.doesNotMatch(serializer[1], /providerMetadata:/);
    assert.doesNotMatch(serializer[1], /requestPayload:/);
});

test("web download endpoint requires the owner-bound export resolver", () => {
    assert.match(webControllerSource, /@Get\("tasks\/:id\/export-file"\)/);
    assert.match(webControllerSource, /getExportFile\(user\.id, id\)/);
    assert.match(webControllerSource, /X-Content-Type-Options/);
    assert.match(webControllerSource, /Cache-Control/);
});
