import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url);
const PROCESSOR_FILE = new URL("../src/api/modules/generation/processors/image-generation.processor.ts", import.meta.url);
const MODEL_CONFIG_SERVICE_FILE = new URL("../src/api/modules/config/services/model-config.service.ts", import.meta.url);
const WEB_SERVICE_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const CONSOLE_SERVICE_FILE = new URL("../src/web/services/console/generation.ts", import.meta.url);
const SERVICE_INDEX_FILE = new URL("../src/web/services/index.ts", import.meta.url);
const TYPES_FILE = new URL("../src/web/services/types/generation.ts", import.meta.url);
const GENERATION_FORM_FILE = new URL("../src/web/components/generation-form.tsx", import.meta.url);
const RESULT_GALLERY_FILE = new URL("../src/web/components/result-gallery.tsx", import.meta.url);
const ERROR_STATE_FILE = new URL("../src/web/components/error-state.tsx", import.meta.url);
const WEB_INDEX_FILE = new URL("../src/web/pages/index.tsx", import.meta.url);
const WEB_DETAIL_FILE = new URL("../src/web/pages/detail.tsx", import.meta.url);
const WEB_MAIN_FILE = new URL("../src/web/main.tsx", import.meta.url);
const WEB_SERVICES_BILLING_FILE = new URL("../src/web/services/web/billing.ts", import.meta.url);
const WEB_SERVICES_GENERATION_FILE = new URL("../src/web/services/web/generation.ts", import.meta.url);
const ROUTES_FILE = new URL("../src/web/routes.tsx", import.meta.url);
const CONSOLE_MODELS_FILE = new URL("../src/web/pages/console/models.tsx", import.meta.url);
const WEB_CONTROLLER_FILE = new URL("../src/api/modules/generation/controllers/web/generation.web.controller.ts", import.meta.url);
const MODEL_OPTIONS_WEB_CONTROLLER_FILE = new URL("../src/api/modules/config/controllers/web/model-options.web.controller.ts", import.meta.url);
const GENERATION_MODULE_FILE = new URL("../src/api/modules/generation/generation.module.ts", import.meta.url);
const WORKSPACE_SHELL_FILE = new URL("../src/web/components/workspace/workspace-shell.tsx", import.meta.url);
const MODE_SWITCH_FILE = new URL("../src/web/components/workspace/mode-switch.tsx", import.meta.url);
const REFERENCE_UPLOAD_FILE = new URL("../src/web/components/reference-image-upload.tsx", import.meta.url);
const FLOW_CANVAS_FILE = new URL("../src/web/components/canvas/generation-flow-canvas.tsx", import.meta.url);
const STYLE_FILE = new URL("../src/web/styles/index.css", import.meta.url);
const VITE_CONFIG_FILE = new URL("../vite.config.ts", import.meta.url);
const BUILD_WEB_SCRIPT_FILE = new URL("../scripts/build-web.mjs", import.meta.url);
const PACKAGE_FILE = new URL("../package.json", import.meta.url);

function extractMethod(source, name) {
    const start = source.indexOf(`private ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    let depth = 0;
    for (let index = start; index < source.length; index++) {
        const char = source[index];
        if (char === "{") depth += 1;
        if (char === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    return source.slice(start);
}

function extractInterface(source, name) {
    const start = source.indexOf(`export interface ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\nexport interface ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

test("image web serializer uses an explicit public whitelist", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const method = extractMethod(source, "toPublicGeneration");

    for (const field of ["id", "status", "prompt", "modelId", "billingAmount"]) {
        assert.match(method, new RegExp(`${field}: record\\.${field}`));
    }
    assert.match(method, /resultImages: \(record\.resultImages \?\? \[\]\)\.flatMap/);
    for (const field of ["rawRequest", "rawResponse", "rawEvents", "baseURL", "provider", "apiMode", "requestPolicy", "failureCode", "failureCategory", "storageFiles", "deletedAt"]) {
        assert.doesNotMatch(method, new RegExp(`record\\.${field}\\b`));
    }
    assert.doesNotMatch(method, /\.\.\./);
});

test("image public model options and types do not expose provider details", async () => {
    const [modelConfigSource, formSource, detailSource, typesSource] = await Promise.all([
        readFile(MODEL_CONFIG_SERVICE_FILE, "utf8"),
        readFile(GENERATION_FORM_FILE, "utf8"),
        readFile(WEB_DETAIL_FILE, "utf8"),
        readFile(TYPES_FILE, "utf8"),
    ]);
    const methodStart = modelConfigSource.indexOf("toWebOption(config:");
    const methodEnd = modelConfigSource.indexOf("\n    private toRuntimeWebCapabilities", methodStart);
    const method = modelConfigSource.slice(methodStart, methodEnd === -1 ? undefined : methodEnd);

    assert.doesNotMatch(method, /\bprovider:/);
    assert.doesNotMatch(method, /pluginConfigId|modelConfigId|promptEnhancerModelId/);
    assert.match(method, /toRuntimeWebCapabilities/);
    assert.match(method, /toPublicDefaultParams/);
    assert.match(method, /toPublicAllowedParams/);
    assert.doesNotMatch(formSource, /\.provider\b/);
    assert.doesNotMatch(detailSource, /\.provider\b|Provider|baseURL|rawRequest|rawResponse/);
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

    assert.match(source, /private async completeGeneration/);
    assert.match(source, /current\.rawRequest = this\.compactRawPayload\(rawRequest\)/);
    assert.match(source, /current\.rawResponse = this\.compactRawPayload\(rawResponse\)/);
    assert.match(source, /value\.replace\(\/;base64,\.\+\$\/i, ";base64,\[omitted\]"\)/);
    assert.match(source, /lowerKey\.includes\("b64_json"\) \|\| lowerKey\.includes\("base64"\)/);
});

test("image generation fails closed when active storage cannot serve private result media", async () => {
    const [serviceSource, moduleSource] = await Promise.all([
        readFile(SERVICE_FILE, "utf8"),
        readFile(GENERATION_MODULE_FILE, "utf8"),
    ]);

    assert.match(serviceSource, /assertPrivateResultStorageSupported/);
    assert.match(serviceSource, /!storageConfig \|\| storageConfig\.storageType !== StorageType\.LOCAL/);
    assert.match(serviceSource, /await this\.assertPrivateResultStorageSupported\(\)/);
    assert.match(moduleSource, /StorageConfig/);
});

test("image generated result files use the core file storage service", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const start = source.indexOf("private async storeResultImages");
    assert.notEqual(start, -1, "storeResultImages should exist");
    const next = source.indexOf("\n    private ", start + 1);
    const method = source.slice(start, next === -1 ? undefined : next);

    assert.match(source, /FileStorageService/);
    assert.match(method, /this\.fileStorageService\.saveBuffer/);
    assert.match(source, /const EXTENSION_ID = "echoflow-image"/);
    assert.match(method, /storageRoot:\s*PRIVATE_STORAGE_ROOT/);
    assert.match(method, /storageRoot: PRIVATE_STORAGE_ROOT/);
    assert.doesNotMatch(method, /\/echoflow-image\/uploads\/\$\{relativePath\}/);
    assert.doesNotMatch(source, /from "node:fs\/promises"/);
    assert.doesNotMatch(method, /\bmkdir\(/);
    assert.doesNotMatch(method, /\bwriteFile\(/);
});

test("image execution reclaims uncommitted generated files", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const start = source.indexOf("private async storeResultImages");
    const next = source.indexOf("\n    private ", start + 1);
    const storeResultImages = source.slice(start, next === -1 ? undefined : next);

    assert.match(source, /private async cleanupStoredResultFiles/);
    assert.match(source, /const EXTENSION_ID = "echoflow-image"/);
    assert.match(source, /this\.fileStorageService\.deleteFile\(\s*storageFile\.path,\s*\{\s*storageRoot: PRIVATE_STORAGE_ROOT,?\s*\}\s*\)/);
    assert.match(storeResultImages, /catch \(error\) \{\s*await this\.cleanupStoredResultFiles\(storageFiles\);\s*throw error;/);
    assert.match(source, /if \(!completion\.transitioned\) \{\s*await this\.reclaimUncommittedResultFiles\(id, storedResult\.storageFiles\);/);
    assert.match(source, /this\.getImageBillingMetadata\(completion\.record\)\.refundRequired === true/);
    assert.match(source, /return this\.findById\(id\);/);
});

test("image generation journals staged output paths before writing and reclaims failed journals", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /private async stageResultStorageFile/);
    assert.match(source, /private async reclaimStagedResultFiles/);
    assert.match(source, /await this\.stageResultStorageFile\(generation\.id, storageFile\)/);
    assert.match(source, /await this\.reclaimStagedResultFiles\(failed\.id\)/);
    assert.match(source, /stagedStorageFiles/);
    assert.match(source, /current\.rawResponse = this\.compactRawPayload\(rawResponse\)/);
});

test("image generation validates generated binary size and signature before storage", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /MAX_GENERATED_IMAGE_BYTES/);
    assert.match(source, /MAX_GENERATED_BATCH_BYTES/);
    assert.match(source, /private decodeGeneratedImage/);
    assert.match(source, /this\.assertGeneratedImageSignature\(buffer, mimeType\)/);
    assert.match(source, /生成图片结果超过大小限制/);
    assert.match(source, /生成图片结果格式无效/);
});

test("image task deletion reclaims its stored result files", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /\.\.\.\(generation\.storageFiles \?\? \[\]\)/);
    assert.match(source, /\.\.\.\(generation\.stagedStorageFiles \?\? \[\]\)/);
    assert.match(source, /await this\.cleanupStoredResultFiles\(storageFiles\)/);
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

test("image generation form keeps template reuse lightweight and local-only", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");

    assert.match(source, /@buildingai\/ui\/components\/ui\/popover/);
    assert.match(source, /getLocalStorage,\s*safeJsonParse,\s*safeJsonStringify/);
    assert.match(source, /FAVORITE_TEMPLATE_STORAGE_KEY/);
    assert.match(source, /const QUICK_TEMPLATE_COUNT = 6/);
    assert.match(source, /function readFavoritePrompts/);
    assert.match(source, /function writeFavoritePrompts/);
    assert.match(source, /const applyTemplate = \(template: TemplateItem, mode: "replace" \| "append"\)/);
    assert.match(source, /mode === "append"/);
    assert.match(source, /收藏模板|取消收藏/);
    assert.doesNotMatch(source, /window\.localStorage/);
    assert.doesNotMatch(source, /JSON\.parse\(/);
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

test("image result stage exposes prompt starters and image continuation without fake progress", async () => {
    const source = await readFile(RESULT_GALLERY_FILE, "utf8");

    assert.match(source, /emptyPromptSuggestions/);
    assert.match(source, /ef-image-light-table/);
    assert.match(source, /ef-image-contact-frame/);
    assert.match(source, /onUsePrompt\?: \(prompt: string\) => void/);
    assert.match(source, /onOpenCanvas\?: \(\) => void/);
    assert.match(source, /onContinueFromImage\?: \(values: Partial<CreateGenerationParams>\) => void/);
    assert.match(source, /function getRunningStage/);
    assert.match(source, /const continueFromImage = \(image: GeneratedImageRecord\)/);
    assert.match(source, /sourceImages: \[\{ fileId: image\.fileId, mimeType: image\.mimeType \}\]/);
    assert.match(source, /作为参考图继续生成/);
    assert.doesNotMatch(source, /\b45%|\b50%|\b75%/);
    assert.doesNotMatch(source, /setTimeout\(/);
});

test("image public web hides image continuation when runtime model options do not support it", async () => {
    const [indexSource, modelConfigSource, flowSource, serviceSource] = await Promise.all([
        readFile(WEB_INDEX_FILE, "utf8"),
        readFile(MODEL_CONFIG_SERVICE_FILE, "utf8"),
        readFile(new URL("../src/web/components/canvas/generation-flow-canvas.tsx", import.meta.url), "utf8"),
        readFile(SERVICE_FILE, "utf8"),
    ]);

    assert.match(modelConfigSource, /toRuntimeWebCapabilities/);
    assert.match(modelConfigSource, /imageToImage:\s*false/);
    assert.match(modelConfigSource, /mask:\s*false/);
    assert.match(modelConfigSource, /multiReference:\s*false/);
    assert.match(modelConfigSource, /negativePrompt:\s*false/);
    assert.match(indexSource, /const canContinueFromImage = useMemo/);
    assert.match(indexSource, /onOpenCanvas=\{\(\) => setWorkspaceMode\("canvas"\)\}/);
    assert.match(indexSource, /onContinueFromImage=\{canContinueFromImage \? handleContinueFromImage : undefined\}/);
    assert.match(flowSource, /const canContinueFromImage = Boolean\(onContinueFromImage\)/);
    assert.match(flowSource, /disabled=\{!image\.src \|\| !canContinueFromImage\}/);
    assert.match(flowSource, /待模型支持/);
    assert.match(serviceSource, /assertRuntimeGenerationSupported\(this\.getRequestedReservedCapabilities\(dto\)\)/);
    assert.match(serviceSource, /getRequestedReservedCapabilities/);
    assert.match(serviceSource, /暂不支持参考图生成/);
    assert.match(serviceSource, /暂不支持局部重绘/);

    const createStart = serviceSource.indexOf("async createAndGenerate");
    const guardIndex = serviceSource.indexOf("assertRuntimeGenerationSupported(this.getRequestedReservedCapabilities(dto))", createStart);
    const normalizeIndex = serviceSource.indexOf("normalizeGenerationRequest(dto", createStart);
    assert.ok(guardIndex > createStart && guardIndex < normalizeIndex, "reserved reference/mask guard must run before request normalization");
});

test("image shared error state avoids static lucide imports on always-available UI paths", async () => {
    const source = await readFile(ERROR_STATE_FILE, "utf8");

    assert.match(source, /@buildingai\/ui\/components\/ui\/alert/);
    assert.match(source, /@buildingai\/ui\/components\/ui\/button/);
    assert.match(source, /aria-hidden="true"/);
    assert.doesNotMatch(source, /lucide-react/);
});

test("image public workspace header is a workspace control bar", async () => {
    const [shellSource, modeSource, indexSource] = await Promise.all([
        readFile(WORKSPACE_SHELL_FILE, "utf8"),
        readFile(MODE_SWITCH_FILE, "utf8"),
        readFile(WEB_INDEX_FILE, "utf8"),
    ]);

    assert.match(shellSource, /新图片任务/);
    assert.match(shellSource, /ef-image-workbench/);
    assert.match(shellSource, /ef-image-controlbar/);
    assert.doesNotMatch(shellSource, /EchoFlowAI 绘画/);
    assert.match(modeSource, /@buildingai\/ui\/components\/ui\/tabs/);
    assert.match(modeSource, /<Tabs/);
    assert.match(modeSource, /<TabsList/);
    assert.match(modeSource, /<TabsTrigger/);
    assert.match(indexSource, /mode=\{workspaceMode\}/);
    assert.match(indexSource, /onModeChange=\{setWorkspaceMode\}/);
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

    assert.match(source, /function createDevRoutes\(\): RouteObject\[\]/);
    assert.match(source, /if \(!import\.meta\.env\.DEV\) return \[\];/);
    assert.match(source, /const DesignSandboxPage = lazy\(\(\) => import\("\.\/pages\/dev\/design-sandbox"\)\)/);
    assert.match(source, /\.\.\.createDevRoutes\(\)/);

    const routeCount = (source.match(/element:\s*<LazyPage>/g) ?? []).length;
    assert.equal(routeCount, 10, "all image web, console, and dev-only design routes should use LazyPage");
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

test("image console generation endpoints require explicit operational access", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");
    const controller = await readFile(new URL("../src/api/modules/generation/controllers/console/generation.controller.ts", import.meta.url), "utf8");

    assert.match(source, /toConsoleGeneration/);
    assert.match(controller, /createAndGenerateForConsole/);
    assert.match(controller, /findConsoleById/);
    assert.match(controller, /retryForConsole/);
    assert.match(controller, /assertConsoleManageAccess\(user\)/);
    assert.match(controller, /user\.isRoot === 1/);
    assert.match(controller, /echoflow-image@generation:manage/);
    assert.doesNotMatch(controller, /return this\.generationService\.findById\(id\)/);
});

test("image generation failures keep provider details out of public copy", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /private publicFailureMessage/);
    assert.match(source, /errorMessage: options\.errorMessage \?\? this\.publicFailureMessage\(failureCategory\)/);
    assert.match(source, /reason: record\.status === ImageGenerationStatus\.FAILED/);
    assert.match(source, /this\.publicFailureMessage\(record\.failureCategory\)/);
    assert.doesNotMatch(source, /reason: record\.errorMessage/);
    assert.doesNotMatch(source, /saved\.errorMessage = this\.truncateText\(rawMessage/);
});

test("image failure diagnostics and worker logs omit upstream error bodies", async () => {
    const [serviceSource, processorSource] = await Promise.all([
        readFile(SERVICE_FILE, "utf8"),
        readFile(PROCESSOR_FILE, "utf8"),
    ]);

    assert.match(serviceSource, /failure:\s*\{\s*category: failureCategory\s*\}/);
    assert.doesNotMatch(serviceSource, /failure:\s*this\.compactRawPayload\(\{ message:/);
    assert.doesNotMatch(serviceSource, /Deduction failed for generation \$\{id\}`, deductError/);
    assert.doesNotMatch(serviceSource, /Queue image generation \$\{id\} failed: \$\{message\}/);
    assert.doesNotMatch(processorSource, /\$\{error\.message\}/);
});


test("image refund failures are persisted as business metadata instead of only user copy", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /refundError/);
    assert.match(source, /rawResponse:/);
    assert.match(source, /lock: \{ mode: "pessimistic_write" \}/);
    assert.match(source, /await manager\.update\(ImageGeneration, current\.id/);
    assert.match(source, /refundFailedAt: new Date\(\)\.toISOString\(\)/);
    assert.match(source, /this\.refundGenerationBilling\(failed, `Refund for crashed generation/);
});

test("image provider result URLs are DNS-checked before being saved", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /assertPublicHttpUrl/);
    assert.match(source, /private async normalizeResultImageUrl/);
    assert.match(source, /await this\.downloadAndValidateResultImage\(img\.url, mimeType\)/);
    assert.match(source, /await assertPublicHttpUrl\(raw, \{ label: "图片结果 URL" \}\)/);
    assert.doesNotMatch(source, /new URL\(normalizePublicHttpUrl\(raw, \{ label: "图片结果 URL" \}\)\)/);
});

test("image generated results are platform files with generation ownership and no public static URL", async () => {
    const [serviceSource, entitySource, typeSource] = await Promise.all([
        readFile(SERVICE_FILE, "utf8"),
        readFile(new URL("../src/api/db/entities/image-generation.entity.ts", import.meta.url), "utf8"),
        readFile(TYPES_FILE, "utf8"),
    ]);

    assert.match(serviceSource, /registerGeneratedFile/);
    assert.match(serviceSource, /fileId/);
    assert.match(serviceSource, /generationId/);
    assert.match(serviceSource, /PRIVATE_STORAGE_ROOT/);
    assert.doesNotMatch(serviceSource, /\/echoflow-image\/uploads\/\$\{relativePath\}/);
    assert.match(entitySource, /fileId\??: string/);
    assert.match(entitySource, /generationId: string/);
    assert.match(typeSource, /fileId\??: string/);
    assert.doesNotMatch(typeSource, /b64Json\??: string/);
});

test("image result reads require authenticated ownership and controlled response headers", async () => {
    const [serviceSource, webController, consoleController] = await Promise.all([
        readFile(SERVICE_FILE, "utf8"),
        readFile(WEB_CONTROLLER_FILE, "utf8"),
        readFile(new URL("../src/api/modules/generation/controllers/console/generation.controller.ts", import.meta.url), "utf8"),
    ]);

    assert.match(serviceSource, /getGenerationResultStream/);
    assert.match(serviceSource, /findOwnedById\(generationId, userId\)/);
    assert.match(serviceSource, /file\.uploaderId !== generation\.userId/);
    assert.match(webController, /@Get\("results\/:generationId\/:fileId"\)/);
    assert.match(webController, /@Playground\(\) user/);
    assert.match(consoleController, /getGenerationResultStream/);
    assert.match(consoleController, /@Playground\(\) user/);
    assert.match(await readFile(new URL("../src/web/pages/console/detail.tsx", import.meta.url), "utf8"), /scope="console"/);
    assert.match(await readFile(new URL("../src/web/pages/console/history.tsx", import.meta.url), "utf8"), /scope="console"/);
    assert.match(serviceSource, /user\?\.isRoot === 1/);
    assert.match(serviceSource, /permissions\?\.includes\(`\$\{EXTENSION_ID\}@generation:media-read`\)/);
    assert.match(serviceSource, /Content-Disposition/);
    assert.match(serviceSource, /X-Content-Type-Options/);
    assert.match(serviceSource, /Cache-Control/);
});

test("image provider result downloads revalidate redirects and verify headers, bytes, MIME, and signatures", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /downloadPublicHttpUrl/);
    assert.match(source, /content-length/);
    assert.match(source, /response\.ok/);
    assert.match(source, /assertGeneratedImageSignature/);
    assert.match(source, /MAX_GENERATED_IMAGE_BYTES/);
    assert.match(source, /timeoutMs/);
    assert.match(source, /maxRedirects/);
});

test("image web fetches protected result media through the authenticated plugin client", async () => {
    const [source, httpClientSource] = await Promise.all([
        readFile(new URL("../src/web/components/image-utils.ts", import.meta.url), "utf8"),
        readFile(new URL("../../../packages/@buildingai/web/http/src/core/http-client.ts", import.meta.url), "utf8"),
    ]);

    assert.match(source, /await client\.download\(path\)/);
    const [flowSource, boardSource] = await Promise.all([
        readFile(FLOW_CANVAS_FILE, "utf8"),
        readFile(new URL("../src/web/components/canvas/inspiration-board.tsx", import.meta.url), "utf8"),
    ]);
    assert.match(flowSource, /resolveImageSrc\(image, generation\.id\)/);
    assert.match(boardSource, /resolveImageSrc\(image, generation\?\.id\)/);
    assert.match(httpClientSource, /responseType: "blob"/);
    assert.match(source, /URL\.createObjectURL/);
    assert.match(source, /URL\.revokeObjectURL/);
    assert.doesNotMatch(source, /window\.fetch\(/);
});

test("image result cleanup deletes platform file records only for the derived generation path", async () => {
    const source = await readFile(SERVICE_FILE, "utf8");

    assert.match(source, /deleteGeneratedFileRecord/);
    assert.match(source, /isGeneratedResultStoragePath\(storageFile\.generationId/);
    assert.match(source, /typeof storageFile\.userId === "string"/);
    assert.match(source, /Refusing to reclaim an untracked image result file/);
    assert.match(source, /storageFile\.fileId/);
    assert.match(source, /uploaderId/);
    assert.match(source, /if \(!cleaned\)/);
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


test("image web model options keep a single public endpoint", async () => {
    const [generationController, modelOptionsController] = await Promise.all([
        readFile(WEB_CONTROLLER_FILE, "utf8"),
        readFile(MODEL_OPTIONS_WEB_CONTROLLER_FILE, "utf8"),
    ]);

    assert.doesNotMatch(generationController, /@Get\("options\/models"\)/);
    assert.match(modelOptionsController, /@ExtensionWebController\("model-options"\)/);
    assert.match(modelOptionsController, /listEnabledForWeb\(\)/);
});


test("image web build config does not duplicate pnpm aliases in the build script", async () => {
    const [viteSource, buildScriptSource] = await Promise.all([
        readFile(VITE_CONFIG_FILE, "utf8"),
        readFile(BUILD_WEB_SCRIPT_FILE, "utf8"),
    ]);

    assert.match(viteSource, /tsconfigPaths:\s*false/);
    assert.doesNotMatch(viteSource, /tsconfigPaths:\s*true/);
    assert.match(buildScriptSource, /loadConfigFromFile/);
    assert.match(buildScriptSource, /mergeConfig/);
    assert.doesNotMatch(buildScriptSource, /\.pnpm\/node_modules/);
    assert.doesNotMatch(buildScriptSource, /alias:\s*\[/);
});


test("image generation form shows reserved capability ledger without enabling unsupported payloads", async () => {
    const source = await readFile(GENERATION_FORM_FILE, "utf8");

    assert.match(source, /const canUseNegativePrompt = selectedModel\?\.capabilities\?\.negativePrompt === true/);
    assert.match(source, /canUseNegativePrompt && !negativePrompt\.trim\(\)/);
    assert.match(source, /\{canUseNegativePrompt && \(/);
    assert.match(source, /reservedCapabilityItems/);
    assert.match(source, /参考图/);
    assert.match(source, /待模型支持/);
    assert.match(source, /局部重绘/);
    assert.match(source, /未开放/);
    assert.match(source, /sourceImages: usableSourceImages/);
    assert.match(source, /canUseImageToImage\s*\?\s*sourceImages/);
    assert.match(source, /effectiveHasReferenceImage \? ImageGenerationMode\.IMAGE_TO_IMAGE : ImageGenerationMode\.TEXT_TO_IMAGE/);
    assert.doesNotMatch(source, /maskImageUrl:/);
    assert.doesNotMatch(source, /seed:/);
    assert.doesNotMatch(source, /background:/);
    assert.doesNotMatch(source, /inputFidelity:/);
    assert.doesNotMatch(source, /moderation:/);
});


test("image workbench CSS stays scoped to ef-image selectors", async () => {
    const source = await readFile(STYLE_FILE, "utf8");
    const selectors = source.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith("{") && line.startsWith("."))
        .map((line) => line.slice(0, -1).trim());

    assert.match(source, /\.ef-image-workbench/);
    assert.match(source, /\.ef-image-light-table/);
    assert.match(source, /\.ef-image-contact-frame/);
    assert.match(source, /\.ef-image-contact-strip/);
    for (const selector of selectors) {
        assert.match(selector, /\.ef-image-/, `custom selector should be ef-image scoped: ${selector}`);
        assert.doesNotMatch(selector, /\bbody\b|\*|\bbutton\b|\bcard\b/i);
    }
});


test("image canvas flow uses shared storage helpers instead of raw localStorage JSON", async () => {
    const source = await readFile(FLOW_CANVAS_FILE, "utf8");

    assert.match(source, /@buildingai\/stores/);
    assert.match(source, /getLocalStorage,\s*safeJsonParse,\s*safeJsonStringify/);
    assert.doesNotMatch(source, /window\.localStorage/);
    assert.doesNotMatch(source, /JSON\.parse\(/);
    assert.doesNotMatch(source, /JSON\.stringify\(/);
});


test("image default shell and form avoid static lucide imports", async () => {
    for (const file of [WEB_INDEX_FILE, WORKSPACE_SHELL_FILE, MODE_SWITCH_FILE, GENERATION_FORM_FILE, REFERENCE_UPLOAD_FILE]) {
        const source = await readFile(file, "utf8");
        assert.doesNotMatch(source, /lucide-react/);
    }
});
