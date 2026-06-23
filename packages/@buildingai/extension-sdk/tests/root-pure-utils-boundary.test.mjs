import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

test("extension SDK pure utility entrypoint does not eagerly load low-level AI providers or DB modules", () => {
    const require = createRequire(import.meta.url);

    assert.doesNotThrow(() => {
        const { buildDefinedWhere, safeJsonParse } = require("@buildingai/extension-sdk/utils/pure");
        assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
        assert.deepEqual(buildDefinedWhere({ ok: true, skipped: undefined }), { ok: true });
    });
});
