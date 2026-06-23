import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const routeSource = readFileSync(
    new URL("../src/web/routes.tsx", import.meta.url),
    "utf8",
);
const mainSource = readFileSync(
    new URL("../src/web/main.tsx", import.meta.url),
    "utf8",
);

describe("astrology web route splitting", () => {
    it("lazy-loads console routes so the embedded user page does not pay for console code", () => {
        assert.doesNotMatch(routeSource, /import\s+AstrologyFortuneConsolePage\s+from\s+["']\.\/pages\/console["']/);
        assert.match(routeSource, /import\s+AstrologyFortuneHomePage\s+from\s+["']\.\/pages["']/);
        assert.doesNotMatch(routeSource, /const\s+AstrologyFortuneHomePage\s*=\s*lazy\(\(\)\s*=>\s*import\(["']\.\/pages["']\)\)/);
        assert.match(routeSource, /lazy\(\(\)\s*=>\s*import\(["']\.\/pages\/console["']\)\)/);
        assert.match(routeSource, /function LazyPage/);
        assert.match(routeSource, /<Skeleton className=/);
        assert.doesNotMatch(routeSource, /正在加载管理页/);
    });

    it("reuses the extension RootLayout query client instead of nesting another provider", () => {
        assert.match(mainSource, /RootLayout/);
        assert.doesNotMatch(mainSource, /new QueryClient\(/);
        assert.doesNotMatch(mainSource, /QueryClientProvider/);
    });
});
