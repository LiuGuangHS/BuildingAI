import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const INDEX_PAGE_FILE = new URL("../src/web/pages/index.tsx", import.meta.url);
const REQUEST_KEY_FILE = new URL("../src/web/lib/request-key.ts", import.meta.url);
const TEMPLATE_SERVICE_FILE = new URL("../src/api/modules/generation/services/template.service.ts", import.meta.url);

function extractInterface(source, name) {
    const start = source.indexOf(`export interface ${name}`);
    assert.notEqual(start, -1, `${name} interface should exist`);
    const next = source.indexOf("\nexport interface ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("web video generation type does not expose provider debug fields", async () => {
    const source = await readFile(TYPES_FILE, "utf8");
    const publicType = extractInterface(source, "VideoGeneration");
    const consoleType = extractInterface(source, "ConsoleVideoGeneration");
    const sensitiveFields = [
        "taskId",
        "adminRemark",
        "rawRequest",
        "rawResponse",
        "billingRuleSnapshot",
    ];

    for (const field of sensitiveFields) {
        assert.equal(
            publicType.includes(field),
            false,
            `VideoGeneration must not expose ${field}`,
        );
        assert.equal(
            consoleType.includes(field),
            true,
            `ConsoleVideoGeneration should retain ${field} for admin diagnostics`,
        );
    }
});

test("video web generation uses main system request ids", async () => {
    const generationFormSource = await readFile(GENERATION_FORM_FILE, "utf8");
    const indexPageSource = await readFile(INDEX_PAGE_FILE, "utf8");

    for (const source of [generationFormSource, indexPageSource]) {
        assert.match(source, /import\s+\{\s*createRequestId\s*\}\s+from\s+"@buildingai\/http"/);
        assert.doesNotMatch(source, /request-key|createRequestKey/);
    }
    await assert.rejects(access(REQUEST_KEY_FILE));
});

test("video runtime services do not import app-only utility helpers", async () => {
    const source = await readFile(TEMPLATE_SERVICE_FILE, "utf8");

    assert.match(source, /import\s+\{\s*buildWhere\s*\}\s+from\s+"@buildingai\/utils"/);
    assert.doesNotMatch(source, /Object\.fromEntries\(Object\.entries/);
    assert.doesNotMatch(source, /function\s+buildTemplateWhere/);
});
