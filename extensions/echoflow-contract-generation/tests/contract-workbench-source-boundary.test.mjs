import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/web/styles/index.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/web/pages/index.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/web/components/contract-workbench/ContractWorkbenchShell.tsx", import.meta.url), "utf8");

test("workbench source does not reintroduce host shell concepts", () => {
    for (const forbidden of ["用户头像", "账号区", "全局统计", "App Header", "营销落地页"]) {
        assert.equal(page.includes(forbidden), false, `${forbidden} should not appear in user workbench source`);
    }
});

test("new workbench layout is component driven instead of css shell driven", () => {
    for (const selector of [".contract-task-bar", ".contract-studio-grid", ".contract-intake-card", ".contract-inspector", ".contract-template-drawer"]) {
        assert.equal(css.includes(selector), false, `${selector} should not return as a workbench shell CSS selector`);
    }
    assert.equal(shell.includes("lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)]"), true);
    assert.equal(shell.includes("xl:grid-cols-[minmax(250px,300px)_minmax(430px,1fr)_minmax(270px,320px)]"), true);
});

test("contract Plate editor workbench is lazy-loaded from the user page", () => {
    assert.match(page, /const ContractDocumentWorkbench = lazy\(\(\) =>/);
    assert.match(page, /import\("\.\.\/components\/contract-editor\/ContractDocumentEditor"\)/);
    assert.match(page, /<Suspense fallback=\{<ContractDocumentLoading \/>}/);
    assert.match(page, /@buildingai\/ui\/components\/ui\/skeleton/);
    assert.doesNotMatch(page, /import\s+\{\s*ContractDocumentWorkbench\s*\}\s+from\s+"..\/components\/contract-editor\/ContractDocumentEditor"/);
});
