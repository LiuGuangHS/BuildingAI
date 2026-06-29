import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pluginViteSource = readFileSync(new URL("../vite.config.mjs", import.meta.url), "utf8");
const platformViteSource = readFileSync(new URL("../../../packages/@buildingai/web/core/src/vite/defineExtensionViteConfig.ts", import.meta.url), "utf8");

describe("astrology vite config boundary", () => {
    it("keeps plugin vite config thin and leaves dependency aliases to the platform extension config", () => {
        assert.doesNotMatch(pluginViteSource, /resolveDependency/);
        assert.doesNotMatch(pluginViteSource, /react-router-dom/);
        assert.doesNotMatch(pluginViteSource, /zustand/);
        assert.match(pluginViteSource, /defineExtensionViteConfig/);
    });

    it("keeps shared extension dependency aliases in web-core", () => {
        assert.match(platformViteSource, /react-router-dom/);
        assert.match(platformViteSource, /react-router\/dom/);
        assert.match(platformViteSource, /zustand/);
        assert.match(platformViteSource, /@buildingai\/utils/);
        assert.match(platformViteSource, /toAliasArray/);
    });
});
