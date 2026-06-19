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
