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

test("non-local uploaded files use the platform URL safety helpers only as a fallback", () => {
    assert.match(serviceSource, /assertPublicHttpUrl/);
    assert.match(serviceSource, /downloadPublicHttpUrl/);
    assert.match(serviceSource, /createReadStream\(fileId, \{ extensionId: EXTENSION_ID \}\)/);
    assert.doesNotMatch(serviceSource, /fileUrl\.startsWith/);
    assert.doesNotMatch(serviceSource, /url\.pathname\.startsWith/);
});

test("contract upload review persists extracted contract content", () => {
    assert.match(serviceSource, /const uploadReviewSchema = contractSchema/);
    assert.match(serviceSource, /Output\.object\(\{ schema: uploadReviewSchema \}\)/);
    assert.match(serviceSource, /title: output\.title\?\.trim\(\) \|\| currentTask\.title/);
    assert.match(serviceSource, /summary: output\.summary\?\.trim\(\) \|\| null/);
    assert.match(serviceSource, /sections,/);
});

test("contract stale cleanup leaves recoverable queue tasks to recovery and fences terminal compensation", () => {
    const match = serviceSource.match(/private async failStaleGenerationTasks[\s\S]*?private async claimTaskForRecovery/);
    assert.ok(match, "failStaleGenerationTasks block should exist");
    assert.match(match[0], /if \(canRecoverContractTask\(task, cutoff\)\) continue/);
    assert.match(match[0], /resolveStaleContractTaskResolution\(task\.status\)/);
    assert.match(match[0], /const processingAttemptId = task\.processingAttemptId \?\? undefined/);
    assert.match(match[0], /refundTaskCreditsIfNeeded\(task\.id, "AI合同任务超时自动退款", processingAttemptId\)/);
    assert.doesNotMatch(match[0], /const recoverableTasks/);
});

test("contract failure notifications do not expose internal errors to users", () => {
    assert.match(serviceSource, /reason: "合同任务处理失败，请稍后重试或联系管理员。"/);
    assert.doesNotMatch(serviceSource, /refundError: task\.providerMetadata\?\.refundError/);
    assert.doesNotMatch(serviceSource, /reason: message/);
});
