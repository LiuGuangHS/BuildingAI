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

    it("uses upstream standard package resolution without workspace-specific dependency aliases", () => {
        assert.doesNotMatch(platformViteSource, /node_modules\/\.pnpm/);
        assert.doesNotMatch(platformViteSource, /react-router-dom/);
        assert.doesNotMatch(platformViteSource, /zustand/);
        assert.doesNotMatch(platformViteSource, /@buildingai\/utils/);
        assert.match(platformViteSource, /tsconfigPaths: true/);
    });
});
