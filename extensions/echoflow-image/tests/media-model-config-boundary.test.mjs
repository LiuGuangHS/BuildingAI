import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
];

test("image model config operational views whitelist main-site model fields", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /toOperationalView\(config: ImageModelConfig \| undefined, model:/);
        assert.match(source, /configured: Boolean\(config\)/);
        assert.match(source, /displayNameOverride: config\?\.displayNameOverride/);
        assert.doesNotMatch(source, /\bendpoints:/);
        assert.doesNotMatch(source, /\bsecretId:/);
        assert.doesNotMatch(source, /apiKeyMasked/);
        assert.doesNotMatch(source, /\.\.\.config,/);
    }
});
