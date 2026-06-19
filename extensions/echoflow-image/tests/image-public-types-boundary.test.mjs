import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);

function extractInterface(source, name) {
    const start = source.indexOf(`export interface ${name}`);
    assert.notEqual(start, -1, `${name} interface should exist`);
    const next = source.indexOf("\nexport interface ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("web image generation type does not expose endpoint base URL", async () => {
    const source = await readFile(TYPES_FILE, "utf8");
    const publicType = extractInterface(source, "ImageGeneration");
    const consoleType = extractInterface(source, "ConsoleImageGeneration");

    assert.equal(publicType.includes("baseURL"), false);
    assert.equal(consoleType.includes("baseURL"), true);
});
