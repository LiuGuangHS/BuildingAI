import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
    new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url),
];

test("image model config operational views use whitelist mapping for endpoints", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /toOperationalView\(config: ImageModelConfig\)/);
        assert.match(source, /endpoints: this\.normalizeEndpointConfigs\(config\.endpoints, \[\]\)/);
        assert.doesNotMatch(source, /return \{\s*\.\.\.this\.toResolvedConfig\(config\),\s*endpoints: config\.endpoints \?\? \[\],\s*\}/s);
        assert.doesNotMatch(source, /apiKeyMasked/);
        assert.doesNotMatch(source, /\.\.\.config,/);
    }
});
