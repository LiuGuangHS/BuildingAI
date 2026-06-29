import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const controllerSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/controllers/web/astrology-fortune.web.controller.ts", import.meta.url),
    "utf8",
);
const serviceSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
    "utf8",
);
const pageSource = readFileSync(
    new URL("../src/web/pages/index.tsx", import.meta.url),
    "utf8",
);
const webServiceSource = readFileSync(
    new URL("../src/web/services/web/astrology-fortune.ts", import.meta.url),
    "utf8",
);
const typesSource = readFileSync(
    new URL("../src/web/services/types/index.ts", import.meta.url),
    "utf8",
);

function extractFunction(name, source = pageSource) {
    const start = source.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
}

describe("astrology web generation availability", () => {
    it("exposes only public generation availability to the user endpoint", () => {
        assert.match(controllerSource, /@Get\("generation-status"\)/);
        assert.match(controllerSource, /getPublicGenerationStatus/);
        assert.match(serviceSource, /async getPublicGenerationStatus/);
        assert.match(serviceSource, /canGenerate/);
        assert.match(serviceSource, /unavailableReason/);
        assert.doesNotMatch(serviceSource.match(/return \{\s*canGenerate[\s\S]*?prices,\s*};/)?.[0] ?? "", /defaultModelId|providerId|secret|apiKey/i);
    });

    it("loads public generation availability through the web service without console-only fields", () => {
        assert.match(typesSource, /export type AstrologyGenerationStatus/);
        assert.match(typesSource, /canGenerate: boolean/);
        assert.match(typesSource, /prices:/);
        assert.doesNotMatch(typesSource.match(/export type AstrologyGenerationStatus[\s\S]*?};/)?.[0] ?? "", /defaultModelId|providerId|secret|apiKey/i);
        assert.match(webServiceSource, /getAstrologyGenerationStatus/);
        assert.match(webServiceSource, /\/astrology-fortune\/generation-status/);
        assert.doesNotMatch(webServiceSource, /consoleHttpClient/);
    });

    it("treats disabled models as unavailable even when the provider is active", () => {
        const publicStatusBody = serviceSource.match(/async getPublicGenerationStatus[\s\S]*?\n    async cleanupStaleReports/)?.[0] ?? "";
        const loadModelBody = serviceSource.match(/private async loadModel[\s\S]*?\n    private async getModelInfo/)?.[0] ?? "";
        const listModelsBody = serviceSource.match(/async listAvailableLlmModels[\s\S]*?\n    private async reserveReportCreditsOnce/)?.[0] ?? "";

        assert.match(publicStatusBody, /model\?\.isActive !== false/);
        assert.match(loadModelBody, /model\.isActive === false/);
        assert.match(listModelsBody, /model\.isActive !== false/);
    });

    it("disables user generation controls when no model is available", () => {
        const rootBody = extractFunction("AstrologyFortuneHomePage");
        const composerBody = extractFunction("ReportComposer");
        const footerBody = extractFunction("GenerationFooter");
        const reportPanelBody = extractFunction("ReportPanel");
        const followUpBody = extractFunction("FollowUpPanel");
        const detailModalBody = extractFunction("ReportDetailModal");

        assert.match(rootBody, /useAstrologyGenerationStatusQuery/);
        assert.match(rootBody, /generationDisabled/);
        assert.match(rootBody, /generationStatus\.data\?\.canGenerate === false/);
        assert.match(composerBody, /disabled={generationDisabled}/);
        assert.match(composerBody, /当前生成服务暂不可用/);
        assert.match(footerBody, /disabled={busy \|\| generationDisabled}/);
        assert.match(reportPanelBody, /disabled={generationDisabled \|\| isReportBusy\(report\.status\)}/);
        assert.match(followUpBody, /disabled={generationDisabled}/);
        assert.match(detailModalBody, /disabled={generationDisabled \|\| isReportBusy\(report\.status\)}/);
    });

    it("uses only backend-required profile fields as the web generation gate", () => {
        const rootBody = extractFunction("AstrologyFortuneHomePage");
        const blockBody = extractFunction("getGenerationBlock");
        const requiredBody = extractFunction("getRequiredProfileMissing");

        assert.match(rootBody, /profileInput: selectedProfile \?\? profileForm/);
        assert.match(blockBody, /getRequiredProfileMissing\(profileInput\)/);
        assert.doesNotMatch(blockBody, /completion\.missing\.length/);
        assert.match(requiredBody, /\["name", "姓名"\]/);
        assert.match(requiredBody, /\["birthDate", "出生日期"\]/);
        assert.doesNotMatch(requiredBody, /birthTime|birthPlace|zodiacSign|moonSign|risingSign/);
        assert.match(blockBody, /generationDisabled/);
    });

    it("keeps public report metadata typed as an explicit whitelist", () => {
        const publicMetadata = typesSource.match(/export type PublicAstrologyReportMetadata[\s\S]*?};\n\nexport type ConsoleAstrologyReportMetadata/)?.[0] ?? "";
        assert.match(publicMetadata, /feedback\?/);
        assert.match(publicMetadata, /sourceReport\?/);
        assert.match(publicMetadata, /generationContext\?/);
        assert.doesNotMatch(publicMetadata, /Record<string, unknown>/);
        assert.doesNotMatch(publicMetadata, /requestPayload|rawResponse|modelId|providerId|secret|apiKey/i);
        assert.match(typesSource, /export type ConsoleAstrologyReport = Omit<AstrologyReport, "providerMetadata">/);
        assert.match(typesSource, /providerMetadata\?: ConsoleAstrologyReportMetadata \| null/);
    });
});
