import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const MODEL_CONFIG_SERVICE_FILE = new URL("../src/api/modules/generation/services/model-config.service.ts", import.meta.url);
const WEB_SERVICE_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const CONSOLE_SERVICE_FILE = new URL("../src/web/services/console/generation.ts", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const HISTORY_LIST_FILE = new URL("../src/web/components/history-list.tsx", import.meta.url);
const VIDEO_RESULT_FILE = new URL("../src/web/components/video-result.tsx", import.meta.url);
const ERROR_STATE_FILE = new URL("../src/web/components/error-state.tsx", import.meta.url);
const CONSOLE_PAGE_FILE = new URL("../src/web/components/console-page.tsx", import.meta.url);
const WEB_INDEX_PAGE_FILE = new URL("../src/web/pages/index.tsx", import.meta.url);
const WEB_HISTORY_PAGE_FILE = new URL("../src/web/pages/history.tsx", import.meta.url);
const WEB_DETAIL_PAGE_FILE = new URL("../src/web/pages/detail.tsx", import.meta.url);
const WEB_STUDIO_PAGE_FILE = new URL("../src/web/pages/studio.tsx", import.meta.url);
const CONSOLE_MODELS_PAGE_FILE = new URL("../src/web/pages/console/models.tsx", import.meta.url);
const VIDEO_LABELS_FILE = new URL("../src/web/lib/video-labels.ts", import.meta.url);
const WEB_CONTROLLER_FILE = new URL("../src/api/modules/generation/controllers/web/generation.web.controller.ts", import.meta.url);
const WEBHOOK_CONTROLLER_FILE = new URL("../src/api/modules/generation/controllers/web/webhook.controller.ts", import.meta.url);
const GENERATION_MODULE_FILE = new URL("../src/api/modules/generation/generation.module.ts", import.meta.url);
const VIDEO_HTTP_CLIENT_FILE = new URL("../src/api/modules/generation/services/video-http-client.ts", import.meta.url);
const PROVIDER_CONFIG_SERVICE_FILE = new URL("../src/api/modules/generation/services/provider-config.service.ts", import.meta.url);
const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const VITE_CONFIG_FILE = new URL("../vite.config.ts", import.meta.url);
const ROUTES_FILE = new URL("../src/web/routes.tsx", import.meta.url);
const MAIN_FILE = new URL("../src/web/main.tsx", import.meta.url);
const WEB_SERVICES_BILLING_FILE = new URL("../src/web/services/web/billing.ts", import.meta.url);
const WEB_SERVICES_GENERATION_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const WEB_SERVICES_TEMPLATES_FILE = new URL("../src/web/services/web/templates.ts", import.meta.url);
const UPGRADE_FILE = new URL("../src/api/upgrade/0.0.1/index.ts", import.meta.url);

function extractMethod(source, name) {
    const start = Math.max(source.indexOf(`private ${name}`), source.indexOf(`private async ${name}`));
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\n    async ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("video web serializer strips provider debug fields", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const method = extractMethod(source, "toPublicGeneration");
    for (const field of [
        "taskId",
        "provider",
        "adminRemark",
        "rawRequest",
        "rawResponse",
        "billingRuleSnapshot",
        "promptOptimizerModelId",
        "failureCategory",
    ]) {
        assert.doesNotMatch(method, new RegExp(`\\b${field}\\b`));
    }
    assert.match(method, /id:\s*record\.id/);
    assert.match(method, /statusEvents:\s*\(record\.statusEvents \?\? \[\]\)\.map/);
    assert.doesNotMatch(method, /\.\.\.publicRecord/);
    assert.doesNotMatch(method, /deletedAt:\s*record\.deletedAt/);
});

test("video public model options keep the config id needed by generation submit", async () => {
    const source = await readFile(MODEL_CONFIG_SERVICE_FILE, "utf8");
    const method = source.slice(
        source.indexOf("toWebOption("),
        source.indexOf("\n    private async ensureDefaultModelConfigs", source.indexOf("toWebOption(")),
    );

    assert.match(method, /id:\s*resolved\.model/);
    assert.match(method, /modelConfigId:\s*resolved\.id/);
    assert.doesNotMatch(method, /\bprovider:/);
});

test("video web and console pages import separate service barrels", async () => {
    for (const file of [WEB_INDEX_PAGE_FILE, WEB_HISTORY_PAGE_FILE, WEB_DETAIL_PAGE_FILE]) {
        assert.match(await readFile(file, "utf8"), /from "\.\.\/services\/web"/);
    }
});

test("video upgrade creates and backfills the soft-delete column used by the entity", async () => {
    const source = await readFile(UPGRADE_FILE, "utf8");

    assert.match(source, /"deleted_at" TIMESTAMP/);
    assert.match(source, /ensureColumn\("video_generation", "deleted_at", "TIMESTAMP"\)/);
});

test("video web services use public client and public generation type", async () => {
    const source = await readFile(WEB_SERVICE_FILE, "utf8");
    assert.match(source, /apiHttpClient/);
    assert.doesNotMatch(source, /consoleHttpClient/);
    assert.match(source, /VideoGeneration/);
    assert.doesNotMatch(source, /ConsoleVideoGeneration/);
});

test("video detail query fails quietly without keeping async pages in loading state", async () => {
    const source = await readFile(WEB_SERVICE_FILE, "utf8");
    assert.match(source, /\/generation\/\$\{id\}`,\s*\{\s*silent:\s*true\s*\}/s);
    assert.match(source, /retry:\s*false/);
});

test("video public status queries fail quietly without global toast noise", async () => {
    const source = await readFile(WEB_SERVICE_FILE, "utf8");

    assert.match(source, /\/generation\/options\/provider-status",\s*\{\s*silent:\s*true\s*\}/s);
    assert.match(source, /\{\s*available:\s*false,\s*configured:\s*false,\s*enabled:\s*false\s*\}/s);
    assert.match(source, /\/generation\/\$\{id\}\/status`,\s*\{\s*silent:\s*true\s*\}/s);
    assert.match(source, /useWebVideoStatusQuery[\s\S]*retry:\s*false/);
    assert.match(source, /useWebRefreshVideoStatusMutation[\s\S]*\/generation\/\$\{id\}\/status`,\s*\{\s*silent:\s*true\s*\}/);
});

test("video console services use console client and console generation type", async () => {
    const source = await readFile(CONSOLE_SERVICE_FILE, "utf8");
    assert.match(source, /consoleHttpClient/);
    assert.doesNotMatch(source, /apiHttpClient/);
    assert.match(source, /ConsoleVideoGeneration/);
});

test("video generation form uses system Button instead of native buttons", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.doesNotMatch(source, /<button\b/);
});

test("video generation and model config fields use the shared Label component instead of raw label controls", async () => {
    for (const file of [GENERATION_FORM_FILE, CONSOLE_MODELS_PAGE_FILE]) {
        const source = await readFile(file, "utf8");
        assert.match(source, /@buildingai\/ui\/components\/ui\/label/);
        assert.doesNotMatch(source, /<label\b/);
        assert.doesNotMatch(source, /<\/label>/);
    }
});

test("video generation form does not disguise billing estimate failures as loading", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");

    assert.match(source, /function getBillingEstimateLabel/);
    assert.match(source, /estimateMutation\.isError/);
    assert.match(source, /预估暂不可用/);
    assert.match(source, /提交时仍会以后端计费规则为准/);
});

test("video generation form explains when the selected mode has no compatible models", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");

    assert.match(source, /compatibleModels\.length === 0/);
    assert.match(source, /当前模式暂无可用模型/);
    assert.match(source, /请在 Console 启用支持该生成方式的视频模型/);
});

test("video generation disables generation controls when no public model is usable", async () => {
    const [indexSource, formSource] = await Promise.all([
        readFile(WEB_INDEX_PAGE_FILE, "utf8"),
        readFile(GENERATION_FORM_FILE, "utf8"),
    ]);

    assert.match(indexSource, /availableModelCount = models\.length/);
    assert.doesNotMatch(indexSource, /model\.available && model\.enabled && model\.configured/);
    assert.match(indexSource, /availableModelCount === 0/);
    assert.match(indexSource, /availableModelCount \? `\$\{availableModelCount\} 个规格可用` : "暂未开放"/);
    assert.match(formSource, /const controlsDisabled = Boolean\(disabledReason\) \|\| Boolean\(loading\) \|\| !selectedModel/);
    assert.match(formSource, /const modeControlsDisabled = Boolean\(disabledReason\) \|\| Boolean\(loading\)/);
    assert.match(formSource, /disabled=\{modeControlsDisabled \|\| !option\.available \|\| modelsLoading\}/);
    assert.match(formSource, /disabled=\{controlsDisabled\}/);
    assert.match(formSource, /disabled=\{controlsDisabled \|\| !prompt\.trim\(\) \|\| optimizePromptMutation\.isPending\}/);
}
);

test("video result and history actions use system Button instead of native buttons", async () => {
    for (const file of [HISTORY_LIST_FILE, VIDEO_RESULT_FILE]) {
        const source = await readFile(file, "utf8");
        assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
        assert.doesNotMatch(source, /<button\b/);
    }
});

test("video shared error state avoids static lucide imports on always-available UI paths", async () => {
    const source = await readFile(ERROR_STATE_FILE, "utf8");

    assert.match(source, /@buildingai\/ui\/components\/ui\/alert/);
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.match(source, /aria-hidden="true"/);
    assert.doesNotMatch(source, /lucide-react/);
});

test("video result long-running states reassure users without encouraging duplicate submissions", async () => {
    const source = await readFile(VIDEO_RESULT_FILE, "utf8");

    assert.match(source, /视频生成不是实时完成/);
    assert.match(source, /生成时间较长时无需重复提交/);
    assert.match(source, /可以稍后从历史中查看结果/);
    assert.match(source, /等待生成结果写回/);
    assert.match(source, /自动轮询/);
    assert.doesNotMatch(source, /toast\.(info|loading|warning).*生成中/s);
});

test("video recent history can reuse parameters without leaving the workbench", async () => {
    const [indexSource, historyListSource] = await Promise.all([
        readFile(WEB_INDEX_PAGE_FILE, "utf8"),
        readFile(HISTORY_LIST_FILE, "utf8"),
    ]);

    assert.match(indexSource, /onReuse=\{handleReuse\}/);
    assert.match(historyListSource, /onReuse\?: \(generation: VideoGeneration\) => void/);
    assert.match(historyListSource, /if \(onReuse\)[\s\S]*onReuse\(item\)/);
    assert.match(historyListSource, /<RotateCcw[\s\S]*复用/);
});

test("video web history model filter comes from public model options instead of hard-coded vendors", async () => {
    const source = await readFile(WEB_HISTORY_PAGE_FILE, "utf8");

    assert.match(source, /useWebVideoModelOptionsQuery/);
    assert.match(source, /models\.map\(\(model\) =>/);
    assert.doesNotMatch(source, /Seedance|Kling|HappyHorse|doubao-seedance|kling-/);
});

test("video detail page explains succeeded tasks without a playable video URL", async () => {
    const source = await readFile(WEB_DETAIL_PAGE_FILE, "utf8");

    assert.match(source, /generation\.status === "succeeded" && !generation\.videoUrl/);
    assert.match(source, /任务完成但未返回视频地址/);
    assert.match(source, /插件不会暴露供应商原始响应/);
});

test("video detail page previews source media without implying it can be reused directly", async () => {
    const source = await readFile(WEB_DETAIL_PAGE_FILE, "utf8");

    assert.match(source, /<CardTitle className="text-lg">素材<\/CardTitle>/);
    assert.match(source, /<img src=\{item\.url\}/);
    assert.match(source, /<video src=\{item\.url\}/);
    assert.match(source, /查看素材/);
    assert.match(source, /rel="noopener noreferrer"/);
    assert.doesNotMatch(source, /复用素材|直接复用素材/);
});

test("video user-facing pages avoid provider and backend operation terminology", async () => {
    for (const file of [WEB_INDEX_PAGE_FILE, WEB_HISTORY_PAGE_FILE, WEB_DETAIL_PAGE_FILE, WEB_STUDIO_PAGE_FILE]) {
        const source = await readFile(file, "utf8");
        assert.doesNotMatch(source, /HappyHorse|Seedance|Kling|Provider|provider|LLM|Webhook|Secret|taskId|rawResponse|Base URL/);
        assert.doesNotMatch(source, /AI视频工作台|AI 视频工作台/);
    }
});

test("video user-facing page titles use consistent business wording", async () => {
    const [indexSource, historySource, detailSource, studioSource] = await Promise.all([
        readFile(WEB_INDEX_PAGE_FILE, "utf8"),
        readFile(WEB_HISTORY_PAGE_FILE, "utf8"),
        readFile(WEB_DETAIL_PAGE_FILE, "utf8"),
        readFile(WEB_STUDIO_PAGE_FILE, "utf8"),
    ]);

    assert.match(indexSource, /useDocumentHead\(\{ title: "视频生成" \}\)/);
    assert.match(historySource, /useDocumentHead\(\{ title: "我的视频历史 - 视频生成" \}\)/);
    assert.match(historySource, />\s*我的视频历史\s*</);
    assert.match(detailSource, /useDocumentHead\(\{ title: "视频详情 - 视频生成" \}\)/);
    assert.match(studioSource, /useDocumentHead\(\{ title: "短视频制作 - 视频生成" \}\)/);
    assert.doesNotMatch(historySource, /我的生成历史/);
}
);

test("video detail page protects mobile layouts from long model names, prompts, and media names", async () => {
    const source = await readFile(WEB_DETAIL_PAGE_FILE, "utf8");

    assert.match(source, /className="break-words text-sm">\{generation\.modelName \|\| generation\.model\}/);
    assert.match(source, /className="break-words text-sm leading-relaxed">\{generation\.prompt\}/);
    assert.match(source, /className="break-words text-sm leading-relaxed">\{generation\.originalPrompt\}/);
    assert.match(source, /className="text-muted-foreground mt-1 break-words text-xs">\{event\.message\}/);
    assert.match(source, /className="max-w-\[180px\] truncate"/);
});

test("video failed states show user-facing refund trust messaging", async () => {
    const [labelsSource, resultSource, historySource, detailSource] = await Promise.all([
        readFile(VIDEO_LABELS_FILE, "utf8"),
        readFile(VIDEO_RESULT_FILE, "utf8"),
        readFile(HISTORY_LIST_FILE, "utf8"),
        readFile(WEB_DETAIL_PAGE_FILE, "utf8"),
    ]);

    assert.match(labelsSource, /function getBillingTrustMessage/);
    assert.match(labelsSource, /任务失败，已按账务事实退款/);
    assert.match(labelsSource, /任务失败，已扣费，等待退款核对/);
    assert.match(labelsSource, /任务失败，扣费或退款异常，请联系管理员/);
    assert.match(resultSource, /getBillingTrustMessage\(generation\)/);
    assert.match(historySource, /getBillingTrustMessage\(item\)/);
    assert.match(detailSource, /getBillingTrustMessage\(generation\)/);
});

test("video console pages use embedded plugin containers instead of full app shells", async () => {
    const consolePageSource = await readFile(CONSOLE_PAGE_FILE, "utf8");
    assert.match(consolePageSource, /max-w-\[1480px\]/);
    assert.doesNotMatch(consolePageSource, /min-h-screen|h-screen|100vh/);

    for (const page of ["index", "config", "detail", "history", "models", "policies", "studio", "templates"]) {
        const source = await readFile(new URL(`../src/web/pages/console/${page}.tsx`, import.meta.url), "utf8");
        assert.match(source, /ConsolePage/);
        assert.doesNotMatch(source, /min-h-screen|h-screen|100vh/);
    }
});

test("video route pages are lazy-loaded instead of bundled into the initial route module", async () => {
    const source = await readFile(ROUTES_FILE, "utf8");

    assert.match(source, /lazy,\s*Suspense/);
    assert.match(source, /const AIVideoIndexPage = lazy\(\(\) => import\("\.\/pages\/index"\)\)/);
    assert.match(source, /const ConsoleVideoModelsPage = lazy\(\(\) => import\("\.\/pages\/console\/models"\)\)/);
    assert.match(source, /function LazyPage/);
    assert.doesNotMatch(source, /import\s+\w+Page\s+from\s+"\.\/pages\//);
    assert.doesNotMatch(source, /import\s+\w+Page\s+from\s+"\.\/pages\/console\//);
});

test("video lazy routes have plugin-scoped error fallbacks", async () => {
    const source = await readFile(ROUTES_FILE, "utf8");

    assert.match(source, /function RouteError/);
    assert.match(source, /页面暂时不可达/);
    assert.match(source, /errorElement:\s*routeErrorElement\(\)/);
    assert.doesNotMatch(source, /lucide-react/, "route registration must not pull lucide into the initial route module");

    const routeCount = (source.match(/element:\s*<LazyPage>/g) ?? []).length;
    const errorCount = (source.match(/errorElement:\s*routeErrorElement\(\)/g) ?? []).length;
    assert.equal(errorCount, routeCount, "every lazy route should define the plugin error fallback");
});

test("video plugin root uses host RootLayout query client instead of a nested client", async () => {
    const [mainSource, servicesSource] = await Promise.all([
        readFile(MAIN_FILE, "utf8"),
        Promise.all([
            readFile(WEB_SERVICES_BILLING_FILE, "utf8"),
            readFile(WEB_SERVICES_GENERATION_FILE, "utf8"),
            readFile(WEB_SERVICES_TEMPLATES_FILE, "utf8"),
        ]).then((parts) => parts.join("\n")),
    ]);

    assert.match(mainSource, /RootLayout/);
    assert.doesNotMatch(mainSource, /QueryClientProvider/);
    assert.doesNotMatch(mainSource, /queryClient/);
    assert.doesNotMatch(servicesSource, /new QueryClient/);
    assert.doesNotMatch(servicesSource, /QueryClientProvider/);
});

test("video web rate limits use the extension SDK limiter instead of a plugin-local service", async () => {
    const [controllerSource, moduleSource] = await Promise.all([
        readFile(WEB_CONTROLLER_FILE, "utf8"),
        readFile(GENERATION_MODULE_FILE, "utf8"),
    ]);

    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace:\s*"echoflow-video"/);
    assert.doesNotMatch(controllerSource, /VideoRequestLimiterService/);
    assert.doesNotMatch(moduleSource, /VideoRequestLimiterService/);
});

test("video provider HTTP requests reuse the extension SDK provider client", async () => {
    const [source, generationSource] = await Promise.all([
        readFile(VIDEO_HTTP_CLIENT_FILE, "utf8"),
        readFile(SERVICE_FILE, "utf8"),
    ]);

    assert.match(source, /requestProviderJson/);
    assert.match(source, /testProviderJsonEndpoint/);
    assert.doesNotMatch(source, /normalizeProviderBaseUrl/);
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.doesNotMatch(source, /function\s+sleep\b/);
    assert.match(generationSource, /safeJsonParse/);
    assert.doesNotMatch(generationSource, /JSON\.parse\(text\)/);
});

test("video provider result URLs are DNS-checked before being saved", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /assertPublicHttpUrl/);
    assert.match(source, /private async normalizeResultVideoUrl/);
    assert.match(source, /await this\.normalizeResultVideoUrl\(pollResult\.videoUrl\)/);
    assert.match(source, /await this\.normalizeResultVideoUrl\(videoUrl\)/);
    assert.doesNotMatch(source, /normalizePublicHttpUrl\(value, \{ label: "视频结果 URL" \}\)/);
});

test("video refund failures are persisted as business metadata instead of only user copy", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /recordRefundFailureMetadata/);
    assert.match(source, /refundError/);
    assert.match(source, /refundFailedAt/);
    assert.match(source, /record\.rawResponse\s*=/);
    assert.match(source, /\.\.\.\(record\.rawResponse \?\? \{\}\)/);
    assert.match(source, /this\.generationRepository\.update\(record\.id,/);
    assert.match(source, /this\.recordRefundFailureMetadata\(record, error\)/);
});

test("video async writes skip soft-deleted records", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const saveMethod = extractMethod(source, "saveNonTerminalUpdate");
    const pollFailureMethod = extractMethod(source, "recordPollScheduleFailure");

    assert.match(saveMethod, /locked\.deletedAt/);
    assert.match(saveMethod, /return locked/);
    assert.match(pollFailureMethod, /record\.deletedAt/);
    assert.match(pollFailureMethod, /isTerminalStatus\(record\.status\)/);
});

test("video webhook secret verification uses constant-time comparison and never logs secrets", async () => {
    const [providerSource, webhookSource] = await Promise.all([
        readFile(PROVIDER_CONFIG_SERVICE_FILE, "utf8"),
        readFile(WEBHOOK_CONTROLLER_FILE, "utf8"),
    ]);

    assert.match(providerSource, /timingSafeEqual/);
    assert.match(providerSource, /safeCompareSecret/);
    assert.doesNotMatch(providerSource, /secret\s*===\s*expectedSecret/);
    assert.match(webhookSource, /@Headers\("x-webhook-secret"\)/);
    assert.doesNotMatch(webhookSource, /logger\.(warn|error|log)\([^)]*secret/is);
});

test("video plugin does not depend on the low-level ai sdk", async () => {
    const packageSource = await readFile(PACKAGE_FILE, "utf8");

    assert.doesNotMatch(packageSource, /@buildingai\/ai-sdk/);
});

test("video web vite config does not resolve backend tsconfig references", async () => {
    const source = await readFile(VITE_CONFIG_FILE, "utf8");

    assert.match(source, /tsconfigPaths:\s*false/);
    assert.doesNotMatch(source, /tsconfigPaths:\s*true/);
});

test("video console JSON inputs reuse the shared safe parser instead of raw JSON.parse", async () => {
    const source = await readFile(new URL("../src/web/pages/console/templates.tsx", import.meta.url), "utf8");

    assert.match(source, /@buildingai\/stores/);
    assert.match(source, /safeJsonParse/);
    assert.doesNotMatch(source, /JSON\.parse\(/);
});

test("video console template ability rows use platform Label and Checkbox controls", async () => {
    const source = await readFile(new URL("../src/web/pages/console/templates.tsx", import.meta.url), "utf8");

    assert.match(source, /@buildingai\/ui\/components\/ui\/label/);
    assert.match(source, /@buildingai\/ui\/components\/ui\/checkbox/);
    assert.doesNotMatch(source, /<label\b/);
    assert.match(source, /htmlFor=\{checkboxId\}/);
    assert.match(source, /id=\{checkboxId\}/);
});
