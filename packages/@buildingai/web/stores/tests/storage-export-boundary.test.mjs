import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const STORAGE_SOURCE = new URL("../src/utils/storage.ts", import.meta.url);
const INDEX_SOURCE = new URL("../src/index.ts", import.meta.url);

test("stores exports browser storage adapters and safe JSON helpers", async () => {
    const [storageSource, indexSource] = await Promise.all([
        readFile(STORAGE_SOURCE, "utf8"),
        readFile(INDEX_SOURCE, "utf8"),
    ]);

    assert.match(storageSource, /function getLocalStorage/);
    assert.match(storageSource, /function getSessionStorage/);
    assert.match(storageSource, /function safeJsonParse/);
    assert.match(storageSource, /function safeJsonStringify/);
    assert.match(indexSource, /getLocalStorage/);
    assert.match(indexSource, /getSessionStorage/);
    assert.match(indexSource, /safeJsonParse/);
    assert.match(indexSource, /safeJsonStringify/);
});
