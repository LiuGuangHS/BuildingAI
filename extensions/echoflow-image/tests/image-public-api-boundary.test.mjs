import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const MODEL_CONFIG_SERVICE_FILE = new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url);
const WEB_SERVICE_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const CONSOLE_SERVICE_FILE = new URL("../src/web/services/console/generation.ts", import.meta.url);
const SERVICE_INDEX_FILE = new URL("../src/web/services/index.ts", import.meta.url);
const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const RESULT_GALLERY_FILE = new URL("../src/web/components/result-gallery.tsx", import.meta.url);
const ERROR_STATE_FILE = new URL("../src/web/components/error-state.tsx", import.meta.url);
const WEB_INDEX_FILE = new URL("../src/web/pages/index.tsx", import.meta.url);
const WEB_MAIN_FILE = new URL("../src/web/main.tsx", import.meta.url);
const WEB_SERVICES_BILLING_FILE = new URL("../src/web/services/web/billing.ts", import.meta.url);
const WEB_SERVICES_GENERATION_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const ROUTES_FILE = new URL("../src/web/routes.tsx", import.meta.url);
const CONSOLE_MODELS_FILE = new URL("../src/web/pages/console/models.tsx", import.meta.url);
const WEB_CONTROLLER_FILE = new URL("../src/api/modules/generation/controllers/web/generation.web.controller.ts", import.meta.url);
const GENERATION_MODULE_FILE = new URL("../src/api/modules/generation/generation.module.ts", import.meta.url);
const PACKAGE_FILE = new URL("../package.json", import.meta.url);

function extractMethod(source, name) {
    const start = source.indexOf(`private ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\n    async ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

function extractInterface(source, name) {
    const start = source.indexOf(`export interface ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\nexport interface ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("image web serializer strips provider debug fields", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const method = extractMethod(source, "toPublicGeneration");
    for (const field of ["rawRequest", "rawResponse", "baseURL", "provider", "deletedAt"]) {
        assert.match(method, new RegExp(`${field}: _${field}`));
    }
});

test("image public model options and types do not expose provider details", async () => {
    const [modelConfigSource, formSource, typesSource] = await Promise.all([
        readFile(MODEL_CONFIG_SERVICE_FILE, "utf8"),
        readFile(GENERATION_FORM_FILE, "utf8"),
        readFile(TYPES_FILE, "utf8"),
    ]);
    const methodStart = modelConfigSource.indexOf("toWebOption(config:");
    const method = modelConfigSource.slice(
        methodStart,
        modelConfigSource.indexOf("\n    private async ensureDefaultModelConfigs", methodStart),
    );

    assert.doesNotMatch(method, /\bprovider:/);
    assert.doesNotMatch(method, /pluginConfigId|modelConfigId|promptEnhancerModelId/);
    assert.doesNotMatch(formSource, /\.provider\b/);
    assert.doesNotMatch(extractInterface(typesSource, "ImageGeneration"), /^\s+provider\??:/m);
    assert.doesNotMatch(extractInterface(typesSource, "ImageModelOption"), /^\s+provider(Name)?\??:/m);
    assert.doesNotMatch(extractInterface(typesSource, "ImageModelOption"), /^\s+promptEnhancerModelId\??:/m);
});

test("image service barrel exports console services used by console pages", async () => {
    const source = await readFile(SERVICE_INDEX_FILE, "utf8");

    for (const item of ["billing", "generation", "model-config", "policy", "templates"]) {
        assert.match(source, new RegExp(`export \\* from "\\./console/${item}"`));
    }
});

test("image generation stores compact raw provider payloads", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    assert.match(source, /saved\.rawRequest = this\.compactRawPayload\(result\.rawRequest\)/);
    assert.match(source, /saved\.rawResponse = this\.compactRawPayload\(result\.rawResponse\)/);
    assert.match(source, /value\.replace\(\/;base64,\.\+\$\/i, ";base64,\[omitted\]"\)/);
    assert.match(source, /lowerKey\.includes\("b64_json"\) \|\| lowerKey\.includes\("base64"\)/);
});

test("image generated result files use the core file storage service", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const start = source.indexOf("private async storeResultImages");
    assert.notEqual(start, -1, "storeResultImages should exist");
    const next = source.indexOf("\n    private ", start + 1);
    const method = source.slice(start, next === -1 ? undefined : next);

    assert.match(source, /FileStorageService/);
    assert.match(method, /this\.fileStorageService\.saveBuffer/);
    assert.match(method, /extensionId:\s*"echoflow-image"/);
    assert.match(method, /\/echoflow-image\/uploads\/\$\{relativePath\}/);
    assert.doesNotMatch(source, /from "node:fs\/promises"/);
    assert.doesNotMatch(method, /\bmkdir\(/);
    assert.doesNotMatch(method, /\bwriteFile\(/);
});

test("image web services use public client and public generation type", async () => {
    const source = await readFile(WEB_SERVICE_FILE, "utf8");
    assert.match(source, /apiHttpClient/);
    assert.doesNotMatch(source, /consoleHttpClient/);
    assert.match(source, /ImageGeneration/);
    assert.doesNotMatch(source, /ConsoleImageGeneration/);
});

test("image console services use console client and console generation type", async () => {
    const source = await readFile(CONSOLE_SERVICE_FILE, "utf8");
    assert.match(source, /consoleHttpClient/);
    assert.doesNotMatch(source, /apiHttpClient/);
    assert.match(source, /ConsoleImageGeneration/);
    assert.doesNotMatch(source, /usePromptEnhanceMutation/);
    assert.doesNotMatch(source, /\/generation\/prompt\/enhance/);
});

test("image generation form uses system Button instead of native buttons", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.doesNotMatch(source, /<button\b/);
});

test("image console model fields use the shared Label component instead of raw label controls", async () => {
    const source = await readFile(CONSOLE_MODELS_FILE, "utf8");
    assert.match(source, /@buildingai\/ui\/components\/ui\/label/);
    assert.doesNotMatch(source, /<label\b/);
    assert.doesNotMatch(source, /<\/label>/);
});

test("image batch download does not use artificial timer delays", async () => {
    const source = await readFile(RESULT_GALLERY_FILE, "utf8");
    assert.match(source, /function ResultGallery/);
    assert.doesNotMatch(source, /setTimeout\(/);
});

test("image shared error state avoids static lucide imports on always-available UI paths", async () => {
    const source = await readFile(ERROR_STATE_FILE, "utf8");

    assert.match(source, /@buildingai\/ui\/components\/ui\/alert/);
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.match(source, /aria-hidden="true"/);
    assert.doesNotMatch(source, /lucide-react/);
});

test("image canvas workspace is lazy-loaded away from the default generation route", async () => {
    const source = await readFile(WEB_INDEX_FILE, "utf8");
    assert.match(source, /const CreativeCanvasWorkspace = lazy\(\(\) =>/);
    assert.match(source, /<Suspense fallback=\{<CanvasLoading \/>}/);
    assert.doesNotMatch(source, /import\s+\{\s*CreativeCanvasWorkspace\s*\}\s+from\s+"..\/components\/canvas\/creative-canvas-workspace"/);
});

test("image route pages are lazy-loaded instead of bundled into the route module", async () => {
    const source = await readFile(ROUTES_FILE, "utf8");
    assert.match(source, /lazy,\s*Suspense/);
    assert.match(source, /const EchoflowImagePublicPage = lazy\(\(\) => import\("\.\/pages\/index"\)\)/);
    assert.match(source, /const ConsoleModelsPage = lazy\(\(\) => import\("\.\/pages\/console\/models"\)\)/);
    assert.match(source, /function LazyPage/);
    assert.doesNotMatch(source, /import\s+\w+Page\s+from\s+"\.\/pages\//);
    assert.doesNotMatch(source, /import\s+\w+Page\s+from\s+"\.\/pages\/console\//);

    const routeCount = (source.match(/element:\s*<LazyPage>/g) ?? []).length;
    assert.equal(routeCount, 9, "all image web and console routes should use LazyPage");
});

test("image entry reuses the extension RootLayout query client instead of nesting another provider", async () => {
    const mainSource = await readFile(WEB_MAIN_FILE, "utf8");
    const [billingSource, generationSource] = await Promise.all([
        readFile(WEB_SERVICES_BILLING_FILE, "utf8"),
        readFile(WEB_SERVICES_GENERATION_FILE, "utf8"),
    ]);

    assert.match(mainSource, /RootLayout/);
    assert.doesNotMatch(mainSource, /new QueryClient\(/);
    assert.doesNotMatch(mainSource, /QueryClientProvider/);
    assert.doesNotMatch(billingSource, /new QueryClient\(/);
    assert.doesNotMatch(billingSource, /QueryClientProvider/);
    assert.doesNotMatch(generationSource, /new QueryClient\(/);
    assert.doesNotMatch(generationSource, /QueryClientProvider/);
});

test("image web rate limits use the extension SDK limiter instead of only business policy counts", async () => {
    const [controllerSource, moduleSource, packageSource] = await Promise.all([
        readFile(WEB_CONTROLLER_FILE, "utf8"),
        readFile(GENERATION_MODULE_FILE, "utf8"),
        readFile(PACKAGE_FILE, "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource);

    assert.match(controllerSource, /ExtensionRateLimitService/);
    assert.match(controllerSource, /namespace:\s*"echoflow-image"/);
    assert.match(controllerSource, /assertRateLimit\("generation", user\.id\)/);
    assert.match(controllerSource, /assertRateLimit\("prompt-enhancement", user\.id\)/);
    assert.match(controllerSource, /action,/);
    assert.match(controllerSource, /suffix:\s*"short"[\s\S]*ttlSeconds:\s*10[\s\S]*limit:\s*5/);
    assert.match(controllerSource, /suffix:\s*"minute"[\s\S]*ttlSeconds:\s*60[\s\S]*limit:\s*20/);
    assert.match(moduleSource, /RedisModule/);
    assert.match(moduleSource, /provide:\s*ExtensionRateLimitService/);
    assert.match(moduleSource, /new ExtensionRateLimitService\(redisService\)/);
    assert.equal(packageJson.dependencies["@buildingai/cache"], "workspace:*");
    assert.doesNotMatch(controllerSource + moduleSource, /ImageRequestLimiterService/);
});

test("image refund failures are persisted as business metadata instead of only user copy", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /recordRefundFailureMetadata/);
    assert.match(source, /refundError/);
    assert.match(source, /refundFailedAt/);
    assert.match(source, /record\.rawResponse\s*=/);
    assert.match(source, /\.\.\.\(record\.rawResponse \?\? \{\}\)/);
    assert.match(source, /this\.generationRepository\.update\(record\.id,/);
    assert.match(source, /this\.recordRefundFailureMetadata\(saved, refundError\)/);
});

test("image provider result URLs are DNS-checked before being saved", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /assertPublicHttpUrl/);
    assert.match(source, /private async normalizeResultImageUrl/);
    assert.match(source, /await this\.normalizeResultImageUrl\(img\.url\)/);
    assert.match(source, /await assertPublicHttpUrl\(raw, \{ label: "图片结果 URL" \}\)/);
    assert.doesNotMatch(source, /new URL\(normalizePublicHttpUrl\(raw, \{ label: "图片结果 URL" \}\)\)/);
});

test("image external reference and mask URLs are DNS-checked before being saved or sent upstream", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /private async normalizeReferenceImageUrl/);
    assert.match(source, /await assertPublicHttpUrl\(value, \{ label: "参考图 URL" \}\)/);
    assert.match(source, /await this\.normalizeGenerationRequest\(dto, effectiveConfig, userId\)/);
    assert.doesNotMatch(source, /const url = new URL\(trustedFile \? value : normalizePublicHttpUrl\(value, \{ label: "参考图 URL" \}\)\)/);
});

test("image platform upload fileId paths do not persist client supplied reference URLs", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /if \(trustedFile\) return undefined/);
    assert.match(source, /normalized\.push\(\{ url, fileId \}\)/);
    assert.match(source, /assertUploadFileUsable\(fileId, userId/);
    assert.match(source, /assertUploadFilesWithinLimit/);
    assert.doesNotMatch(source, /const url = await this\.normalizeReferenceImageUrl\(item\.url, Boolean\(fileId\)\);/);
});

test("image console JSON inputs reuse the shared safe parser instead of raw JSON.parse", async () => {
    for (const file of [CONSOLE_MODELS_FILE, new URL("../src/web/pages/console/templates.tsx", import.meta.url)]) {
        const source = await readFile(file, "utf8");

        assert.match(source, /@buildingai\/stores/);
        assert.match(source, /safeJsonParse/);
        assert.doesNotMatch(source, /JSON\.parse\(/);
    }
});
