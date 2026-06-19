import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const HELPERS_FILE = new URL("../src/utils/helpers.ts", import.meta.url);

test("createRequestId prefers platform crypto randomUUID", async () => {
    const source = await readFile(HELPERS_FILE, "utf8");

    assert.match(source, /export function createRequestId\(\): string/);
    assert.match(source, /crypto/);
    assert.match(source, /randomUUID/);
});
