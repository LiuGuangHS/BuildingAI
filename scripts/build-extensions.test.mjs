import assert from "node:assert/strict";
import test from "node:test";

import { getLocalExtensionIdentifiers } from "./build-extensions.mjs";

test("selects only enabled local extensions", () => {
    const identifiers = getLocalExtensionIdentifiers({
        applications: {
            enabled: { isLocal: true, enabled: true, manifest: { identifier: "enabled" } },
            implicit: { isLocal: true, manifest: { identifier: "implicit" } },
            disabled: { isLocal: true, enabled: false, manifest: { identifier: "disabled" } },
            remote: { isLocal: false, enabled: true, manifest: { identifier: "remote" } },
        },
    });

    assert.deepEqual(identifiers, ["enabled", "implicit"]);
});
