import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_SERVICE = new URL("src/modules/notification/extension-notification.service.ts", ROOT);
const DIST_SERVICE_DTS = new URL("dist/modules/notification/extension-notification.service.d.ts", ROOT);
const DIST_SERVICE_JS = new URL("dist/modules/notification/extension-notification.service.js", ROOT);

test("extension notification service has a shared resolved extension id path", async () => {
    const [src, distDts, distJs] = await Promise.all([
        readFile(SRC_SERVICE, "utf8"),
        readFile(DIST_SERVICE_DTS, "utf8"),
        readFile(DIST_SERVICE_JS, "utf8"),
    ]);

    assert.match(src, /private resolveExtensionId\(\)/);
    assert.match(src, /const extensionId = this\.resolveExtensionId\(\);/);
    assert.match(distDts, /private resolveExtensionId;/);
    assert.match(distJs, /resolveExtensionId\(\)/);
});
