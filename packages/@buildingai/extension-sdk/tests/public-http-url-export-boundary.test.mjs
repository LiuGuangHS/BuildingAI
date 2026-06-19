import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_INDEX = new URL("src/index.ts", ROOT);
const DIST_INDEX_DTS = new URL("dist/index.d.ts", ROOT);
const DIST_INDEX_JS = new URL("dist/index.js", ROOT);
const DIST_HELPER_DTS = new URL("dist/utils/public-http-url.d.ts", ROOT);
const DIST_HELPER_JS = new URL("dist/utils/public-http-url.js", ROOT);
const DIST_WHERE_DTS = new URL("dist/utils/where.d.ts", ROOT);
const DIST_WHERE_JS = new URL("dist/utils/where.js", ROOT);

const PUBLIC_HTTP_URL_EXPORTS = [
    "assertPublicHttpUrl",
    "isPrivateOrReservedIp",
    "normalizePublicHttpUrl",
    "buildDefinedWhere",
];

test("public HTTP URL helpers are exported from source and dist entrypoints", async () => {
    const [srcIndex, distDts, distJs] = await Promise.all([
        readFile(SRC_INDEX, "utf8"),
        readFile(DIST_INDEX_DTS, "utf8"),
        readFile(DIST_INDEX_JS, "utf8"),
    ]);

    for (const exportName of PUBLIC_HTTP_URL_EXPORTS) {
        assert.match(srcIndex, new RegExp(`\\b${exportName}\\b`));
        assert.match(distDts, new RegExp(`\\b${exportName}\\b`));
        assert.match(distJs, new RegExp(`\\b${exportName}\\b`));
    }
});

test("public HTTP URL helper dist files exist for plugin runtime imports", async () => {
    await Promise.all([
        access(DIST_HELPER_DTS),
        access(DIST_HELPER_JS),
        access(DIST_WHERE_DTS),
        access(DIST_WHERE_JS),
    ]);
});
