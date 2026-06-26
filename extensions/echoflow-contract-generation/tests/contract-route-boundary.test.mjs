import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const routesSource = readFileSync(new URL("../src/web/routes.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/web/main.tsx", import.meta.url), "utf8");
const consoleTemplatesSource = readFileSync(new URL("../src/web/pages/console/templates.tsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("contract route pages are lazy-loaded instead of bundled into the route module", () => {
    assert.match(routesSource, /lazy,\s*Suspense/);
    assert.match(routesSource, /const ContractGenerationHomePage = lazy\(\(\) => import\("\.\/pages"\)\)/);
    assert.match(routesSource, /const ContractGenerationConfigPage = lazy\(\(\) => import\("\.\/pages\/console\/config"\)\)/);
    assert.match(routesSource, /function LazyPage/);
    assert.doesNotMatch(routesSource, /import\s+\w+Page\s+from\s+"\.\/pages/);

    const routeCount = (routesSource.match(/element:\s*<LazyPage>/g) ?? []).length;
    assert.equal(routeCount, 4, "all contract web and console routes should use LazyPage");
});

test("contract entry reuses the extension RootLayout query client instead of nesting another provider", () => {
    assert.match(mainSource, /RootLayout/);
    assert.doesNotMatch(mainSource, /new QueryClient\(/);
    assert.doesNotMatch(mainSource, /QueryClientProvider/);
});

test("contract console JSON inputs reuse the shared safe parser instead of raw JSON.parse", () => {
    assert.match(packageSource, /@buildingai\/stores/);
    assert.match(consoleTemplatesSource, /@buildingai\/stores/);
    assert.match(consoleTemplatesSource, /safeJsonParse/);
    assert.doesNotMatch(consoleTemplatesSource, /JSON\.parse\(/);
});

test("contract non-platform uploaded file URLs are DNS-checked before parsing", () => {
    assert.match(serviceSource, /assertPublicHttpUrl/);
    assert.match(serviceSource, /private async normalizeStoredFileUrl/);
    assert.match(serviceSource, /await this\.normalizeStoredFileUrl\(file\.url\)/);
    assert.match(serviceSource, /value\.startsWith\(`\/\$\{EXTENSION_ID\}\/uploads\/`\) \|\| value\.startsWith\("\/uploads\/"\)/);
    assert.match(serviceSource, /await assertPublicHttpUrl\(value, \{ label: "合同文件 URL" \}\)/);
    assert.doesNotMatch(serviceSource, /url\.pathname\.startsWith\(`\/\$\{EXTENSION_ID\}\/uploads\/`\)|url\.pathname\.startsWith\("\/uploads\/"\)/);
});

test("contract failure notifications do not expose internal errors to users", () => {
    assert.match(serviceSource, /reason: "合同任务处理失败，请稍后重试或联系管理员。"/);
    assert.doesNotMatch(serviceSource, /refundError: task\.providerMetadata\?\.refundError/);
    assert.doesNotMatch(serviceSource, /reason: message/);
});
