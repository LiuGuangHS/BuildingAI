import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const WEB_SERVICE_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const CONSOLE_SERVICE_FILE = new URL("../src/web/services/console/generation.ts", import.meta.url);

function extractMethod(source, name) {
    const start = source.indexOf(`private ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\n    async ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("image web serializer strips provider debug fields", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const method = extractMethod(source, "toPublicGeneration");
    for (const field of ["rawRequest", "rawResponse", "baseURL", "deletedAt"]) {
        assert.match(method, new RegExp(`${field}: _${field}`));
    }
});

test("image web services use public client and public generation type", async () => {
    const source = await readFile(WEB_SERVICE_FILE, "utf8");
    assert.match(source, /apiHttpClient/);
    assert.doesNotMatch(source, /consoleHttpClient/);
    assert.match(source, /ImageGeneration/);
    assert.doesNotMatch(source, /ConsoleImageGeneration/);
});

test("image console services use console client and console generation type", async () => {
    const source = await readFile(CONSOLE_SERVICE_FILE, "utf8");
    assert.match(source, /consoleHttpClient/);
    assert.doesNotMatch(source, /apiHttpClient/);
    assert.match(source, /ConsoleImageGeneration/);
});
