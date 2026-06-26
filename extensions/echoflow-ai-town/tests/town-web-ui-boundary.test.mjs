import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const AI_CONFIG_FILE = new URL("../src/web/pages/console/ai-config.tsx", import.meta.url);
const GAME_PANELS_FILE = new URL("../src/web/components/game-panels.tsx", import.meta.url);
const ROUTES_FILE = new URL("../src/web/routes.tsx", import.meta.url);
const TOWN_STYLE_FILE = new URL("../src/web/styles/index.css", import.meta.url);

test("town console AI config fields use the shared Label component", () => {
    const source = readFileSync(AI_CONFIG_FILE, "utf8");
    assert.match(source, /@buildingai\/ui\/components\/ui\/label/);
    assert.doesNotMatch(source, /<label\b/);
    assert.doesNotMatch(source, /<\/label>/);
});

test("town user-facing action controls use the shared Button component", () => {
    const source = readFileSync(GAME_PANELS_FILE, "utf8");
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.doesNotMatch(source, /<button\b/);
    assert.doesNotMatch(source, /<\/button>/);
});

test("town visual shell reads as a playable town instead of generic AI purple chrome", () => {
    const source = readFileSync(TOWN_STYLE_FILE, "utf8");

    assert.match(source, /\.town-game-shell/);
    assert.match(source, /#f7d99a/);
    assert.match(source, /#28462f/);
    assert.match(source, /#7a4a22/);
    assert.doesNotMatch(source, /#120b22|#24113f|#442164|#2d1651|#4c2580|#754cff/i);
    assert.doesNotMatch(source, /letter-spacing:\s*(?!0\b)/);
});

test("town parent frame sync pins postMessage to the expected parent origin", () => {
    const source = readFileSync(ROUTES_FILE, "utf8");

    assert.match(source, /function getParentFrameOrigin\(\)/);
    assert.match(source, /return window\.location\.origin/);
    assert.doesNotMatch(source, /document\.referrer/);
    assert.match(source, /event\.source !== window\.parent/);
    assert.match(source, /event\.origin !== parentOrigin/);
    assert.match(source, /function normalizeParentNavigation\(/);
    assert.match(source, /!path\.startsWith\("\/"\)/);
    assert.match(source, /path\.startsWith\("\/\/"\)/);
    assert.match(source, /!search\.startsWith\("\?"\)/);
    assert.match(source, /!hash\.startsWith\("#"\)/);
    assert.doesNotMatch(source, /postMessage\([\s\S]*,\s*"\*"\s*\)/);
});
