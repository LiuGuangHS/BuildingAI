import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC_DOWNLOADER = new URL("src/utils/public-http-download.ts", ROOT);
const DIST_DOWNLOADER_DTS = new URL("dist/utils/public-http-download.d.ts", ROOT);
const DIST_DOWNLOADER_JS = new URL("dist/utils/public-http-download.js", ROOT);
const SRC_INDEX = new URL("src/index.ts", ROOT);
const DIST_INDEX_DTS = new URL("dist/index.d.ts", ROOT);
const DIST_INDEX_JS = new URL("dist/index.js", ROOT);

const REQUIRED_EXPORTS = ["downloadPublicHttpUrl", "PublicHttpDownloadOptions", "PublicHttpDownloadResult"];

test("public HTTP downloader is exported from source and dist entrypoints", async () => {
    const [srcIndex, distDts, distJs] = await Promise.all([
        readFile(SRC_INDEX, "utf8"),
        readFile(DIST_INDEX_DTS, "utf8"),
        readFile(DIST_INDEX_JS, "utf8"),
    ]);

    for (const exportName of REQUIRED_EXPORTS) {
        assert.match(srcIndex, new RegExp(`\\b${exportName}\\b`));
        assert.match(distDts, new RegExp(`\\b${exportName}\\b`));
    }
    assert.match(distJs, /public-http-download/);
});

test("public HTTP downloader centralizes DNS-bound binary download safety", async () => {
    const [srcDownloader, distDownloaderDts, distDownloaderJs] = await Promise.all([
        readFile(SRC_DOWNLOADER, "utf8"),
        readFile(DIST_DOWNLOADER_DTS, "utf8"),
        readFile(DIST_DOWNLOADER_JS, "utf8"),
    ]);

    assert.match(srcDownloader, /node:http/);
    assert.match(srcDownloader, /node:https/);
    assert.match(srcDownloader, /resolvePublicHttpUrl/);
    assert.match(srcDownloader, /lookup:/);
    assert.match(srcDownloader, /\.address/);
    assert.match(srcDownloader, /\.family/);
    assert.match(srcDownloader, /maxBytes/);
    assert.match(srcDownloader, /maxRedirects/);
    assert.match(srcDownloader, /AbortController/);
    assert.match(srcDownloader, /continue;/);
    assert.match(srcDownloader, /\[key\.toLowerCase\(\)\] = String\(firstValue\)/);
    assert.match(distDownloaderDts, /downloadPublicHttpUrl/);
    assert.match(distDownloaderJs, /downloadPublicHttpUrl/);
    await Promise.all([access(DIST_DOWNLOADER_DTS), access(DIST_DOWNLOADER_JS)]);
});
