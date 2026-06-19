import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);
const HISTORY_LIST_FILE = new URL("../src/web/components/history-list.tsx", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const REQUEST_KEY_FILE = new URL("../src/web/lib/request-key.ts", import.meta.url);
const GENERATION_SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const TEMPLATE_SERVICE_FILE = new URL("../src/api/modules/template/services/template.service.ts", import.meta.url);

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

test("shared image history list does not depend on console generation type", async () => {
    const source = await readFile(HISTORY_LIST_FILE, "utf8");

    assert.doesNotMatch(source, /ConsoleImageGeneration/);
    assert.match(source, /type\s+HistoryListItem\s*=\s*ImageGeneration\s*&\s*\{\s*userId\?:\s*string\s*\}/);
});

test("image web generation uses main system request ids", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");

    assert.match(source, /import\s+\{\s*createRequestId\s*\}\s+from\s+"@buildingai\/http"/);
    assert.doesNotMatch(source, /request-key|createRequestKey/);
    await assert.rejects(access(REQUEST_KEY_FILE));
});

test("image runtime services reuse main-system query helpers", async () => {
    for (const file of [GENERATION_SERVICE_FILE, TEMPLATE_SERVICE_FILE]) {
        const source = await readFile(file, "utf8");

        assert.match(source, /buildDefinedWhere/);
        assert.match(source, /@buildingai\/extension-sdk/);
        assert.doesNotMatch(source, /@buildingai\/utils/);
        assert.doesNotMatch(source, /Object\.fromEntries\(Object\.entries/);
    }
});
