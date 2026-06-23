import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(
    new URL("../src/web/pages/index.tsx", import.meta.url),
    "utf8",
);

test("astrology web page keeps plugin CSS minimal and prefers platform components", () => {
    const styleBlock = pageSource.match(/const styles = `([\s\S]*?)`;/)?.[1] ?? "";
    const cssLines = styleBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    const selectorCount = [...styleBlock.matchAll(/^\s*\.[^{]+/gm)].length;

    assert.ok(cssLines.length <= 35, `expected at most 35 non-empty css lines, got ${cssLines.length}`);
    assert.ok(selectorCount <= 24, `expected at most 24 custom selectors, got ${selectorCount}`);
    assert.doesNotMatch(styleBlock, /body\s*\{/);
    assert.doesNotMatch(styleBlock, /\*\s*\{/);
    assert.doesNotMatch(styleBlock, /linear-gradient|radial-gradient|100vh|100dvh/);
});

test("astrology checklist controls use the platform Label component", () => {
    assert.match(pageSource, /@buildingai\/ui\/components\/ui\/label/);
    assert.doesNotMatch(pageSource, /<label\b/);
    assert.match(pageSource, /htmlFor=\{checkboxId\}/);
    assert.match(pageSource, /id=\{checkboxId\}/);
    assert.match(pageSource, /useId/);
    assert.doesNotMatch(pageSource, /`review-checklist-\$\{index\}`/);
    assert.doesNotMatch(pageSource, /`action-list-\$\{index\}`/);
});

test("embedded astrology workspaces do not stretch composer panels to app-shell height", () => {
    assert.doesNotMatch(pageSource, /self-stretch/);
    assert.ok(
        [...pageSource.matchAll(/grid items-start gap-3 lg:grid-cols-\[minmax\(0,1\.04fr\)_minmax\(300px,\.96fr\)\]/g)].length >= 2,
        "expected today and profile workspaces to align to content height",
    );
    assert.ok(
        [...pageSource.matchAll(/grid items-start gap-3 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,\.96fr\)\]/g)].length >= 3,
        "expected ask, relationship, and report workspaces to align to content height",
    );
    assert.match(pageSource, /<form className="self-start rounded-md border bg-card p-4"/);
});
