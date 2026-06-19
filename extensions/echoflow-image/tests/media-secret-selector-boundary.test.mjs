import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const files = [
    new URL("../src/web/pages/console/models.tsx", import.meta.url),
    new URL("../../echoflow-video/src/web/pages/console/models.tsx", import.meta.url),
    new URL("../../echoflow-video/src/web/pages/console/config.tsx", import.meta.url),
];

test("media console pages reuse the main-system SecretReferenceSelect", () => {
    for (const file of files) {
        const source = readFileSync(file, "utf8");
        const path = fileURLToPath(file);

        assert.match(source, /@buildingai\/ui\/components\/secret-reference-select/, path);
        assert.doesNotMatch(source, /function\s+SecretSelect\b/, path);
    }
});

test("media model endpoint editors do not query secrets per endpoint", () => {
    for (const file of files.slice(0, 2)) {
        const source = readFileSync(file, "utf8");
        const path = fileURLToPath(file);
        const endpointEditorStart = source.indexOf("function EndpointEditor");

        assert.notEqual(endpointEditorStart, -1, path);
        assert.doesNotMatch(source.slice(endpointEditorStart), /useSecretsListQuery\s*\(/, path);
    }
});
