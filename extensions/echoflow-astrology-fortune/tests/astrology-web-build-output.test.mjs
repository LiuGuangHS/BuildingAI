import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const htmlPath = new URL("../.output/public/index.html", import.meta.url);

describe("astrology web build output", () => {
    it("serves as an embedded plugin entry instead of a standalone app shell", (context) => {
        if (!existsSync(htmlPath)) {
            context.skip("run build:web or build:publish before this build-output smoke test");
            return;
        }
        const html = readFileSync(htmlPath, "utf8");

        assert.match(html, /<div id="root"><\/div>/);
        assert.match(html, /\/extension\/echoflow-astrology-fortune\/assets\/index-[^"]+\.js/);
        assert.match(html, /\/extension\/echoflow-astrology-fortune\/assets\/index-[^"]+\.css/);
        assert.doesNotMatch(html, /marketing|hero|app-header|sidebar|avatar|account/i);
    });
});
