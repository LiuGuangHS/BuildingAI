import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_SERVICE = new URL("src/modules/billing/extension-billing.service.ts", ROOT);

test("extension billing service resolves extension id in build and source module stacks", async () => {
    const source = await readFile(SRC_SERVICE, "utf8");

    assert.match(source, /getExtensionIdentifierFromStack\(\["\/build\/modules\/", "\/src\/api\/modules\/"\]\)/);
});
