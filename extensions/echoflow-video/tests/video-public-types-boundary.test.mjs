import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const INDEX_PAGE_FILE = new URL("../src/web/pages/index.tsx", import.meta.url);
const REQUEST_KEY_FILE = new URL("../src/web/lib/request-key.ts", import.meta.url);
const TEMPLATE_SERVICE_FILE = new URL("../src/api/modules/generation/services/template.service.ts", import.meta.url);
const PROVIDER_CONFIG_SERVICE_FILE = new URL("../src/api/modules/generation/services/provider-config.service.ts", import.meta.url);

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
        "provider",
        "adminRemark",
        "rawRequest",
        "rawResponse",
        "billingRuleSnapshot",
        "failureCategory",
        "promptOptimizerModelId",
    ];

    for (const field of sensitiveFields) {
        assert.equal(
            new RegExp(`^\\s+${field}\\??:`, "m").test(publicType),
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

    assert.match(indexPageSource, /import\s+\{\s*createRequestId\s*\}\s+from\s+"@buildingai\/http"/);
    assert.match(indexPageSource, /requestKey/);
    assert.doesNotMatch(generationFormSource, /import\s+\{\s*createRequestId\s*\}\s+from\s+"@buildingai\/http"/);
    assert.doesNotMatch(generationFormSource, /requestKey:\s*createRequestId/);
    assert.doesNotMatch(`${generationFormSource}\n${indexPageSource}`, /request-key|createRequestKey/);
    await assert.rejects(access(REQUEST_KEY_FILE));
});

test("video runtime services do not import app-only utility helpers", async () => {
    const source = await readFile(TEMPLATE_SERVICE_FILE, "utf8");

    assert.match(source, /buildDefinedWhere/);
    assert.match(source, /@buildingai\/extension-sdk/);
    assert.doesNotMatch(source, /@buildingai\/utils/);
    assert.doesNotMatch(source, /Object\.fromEntries\(Object\.entries/);
});

test("video provider configuration does not import the low-level ai sdk for constants", async () => {
    const source = await readFile(PROVIDER_CONFIG_SERVICE_FILE, "utf8");

    assert.doesNotMatch(source, /@buildingai\/ai-sdk/);
    assert.doesNotMatch(source, /InjectRepository\(AiModel\)/);
    assert.doesNotMatch(source, /import\s+\{[^}]*\bAiModel\b[^}]*\}\s+from\s+"@buildingai\/db\/entities"/);
    assert.match(source, /listActiveLlmModels/);
});
