import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
    new URL("../src/web/pages/console/models.tsx", import.meta.url),
    new URL("../../echoflow-video/src/web/pages/console/models.tsx", import.meta.url),
    new URL("../../echoflow-video/src/web/pages/console/config.tsx", import.meta.url),
];

test("media console pages reuse main-site models without endpoint Secret selectors", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");

        assert.doesNotMatch(source, /SecretReferenceSelect/);
        assert.doesNotMatch(source, /useSecretsListQuery\s*\(/);
        assert.doesNotMatch(source, /function\s+(?:SecretSelect|EndpointEditor)\b/);
    }
});
