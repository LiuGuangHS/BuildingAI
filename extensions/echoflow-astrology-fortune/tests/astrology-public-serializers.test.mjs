import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
    toConsoleAstrologyReport,
    toPublicAstrologyReport,
    toPublicAstrologyProfile,
} from "../src/api/modules/astrology-fortune/services/astrology-public-serializers.ts";
import { isGenerationUnavailable as isWebGenerationUnavailable } from "../src/web/utils/generation-gate.ts";

const webControllerSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/controllers/web/astrology-fortune.web.controller.ts", import.meta.url),
    "utf8",
);
const consoleControllerSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/controllers/console/astrology-fortune.controller.ts", import.meta.url),
    "utf8",
);

const profile = {
    id: "profile-1",
    userId: "user-1",
    name: "我的档案",
    gender: "未知",
    birthDate: "1990-01-02",
    birthTime: "08:30",
    birthPlace: "上海",
    zodiacSign: "摩羯座",
    moonSign: null,
    risingSign: null,
    chineseZodiac: "马",
    personalitySnapshot: { summary: "稳定" },
    metadata: { internalFlag: true },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
};

const report = {
    id: "report-1",
    userId: "user-1",
    profileId: "profile-1",
    modelId: "model-1",
    providerId: "provider-1",
    reportType: "daily",
    question: "今天如何安排？",
    targetProfile: { name: "对方", birthDate: "1991-02-03" },
    status: "success",
    result: { title: "今日建议", summary: "保持节奏" },
    resultText: "内部完整文本",
    score: 80,
    tags: ["daily"],
    isFavorite: false,
    costCredits: 2,
    errorMessage: null,
    providerMetadata: {
        feedback: { rating: "useful", note: "有帮助", internalNote: "operator-only" },
        sourceReport: { id: "source-1", reportType: "daily", title: "来源", rawResult: "internal" },
        generationContext: { reportType: "daily", hasTargetProfile: false, rawTargetProfile: { apiKey: "secret" } },
        apiKey: "secret",
        baseUrl: "https://internal.example",
        processingLockedAt: "2026-01-01T00:00:00.000Z",
        failureReason: "internal failure",
        refundError: "internal refund error",
        aiRepairAttempted: true,
        aiRepairSucceeded: true,
        aiRepairReason: "malformed output",
    },
    requestPayload: { prompt: "包含用户原始上下文" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
};

describe("astrology public serializers", () => {
    it("returns an explicit public profile allowlist", () => {
        const result = toPublicAstrologyProfile(profile);

        assert.deepEqual(result, {
            id: "profile-1",
            name: "我的档案",
            gender: "未知",
            birthDate: "1990-01-02",
            birthTime: "08:30",
            birthPlace: "上海",
            zodiacSign: "摩羯座",
            moonSign: null,
            risingSign: null,
            chineseZodiac: "马",
            personalitySnapshot: { summary: "稳定" },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });
        assert.equal("userId" in result, false);
        assert.equal("metadata" in result, false);
        assert.equal("deletedAt" in result, false);
    });

    it("keeps the web report free of target and internal generation data", () => {
        const result = toPublicAstrologyReport(report);

        assert.equal("targetProfile" in result, false);
        assert.equal("requestPayload" in result, false);
        assert.equal("modelId" in result, false);
        assert.equal("providerId" in result, false);
        assert.equal("userId" in result, false);
        assert.equal("deletedAt" in result, false);
        assert.deepEqual(result.providerMetadata, {
            feedback: { rating: "useful", note: "有帮助" },
            sourceReport: { id: "source-1", reportType: "daily", title: "来源" },
            generationContext: { reportType: "daily", hasTargetProfile: false },
        });
    });

    it("keeps only bounded console diagnostics", () => {
        const result = toConsoleAstrologyReport(report);

        assert.equal(result.userId, "user-1");
        assert.equal(result.modelId, "model-1");
        assert.equal(result.providerId, "provider-1");
        assert.equal("targetProfile" in result, false);
        assert.equal("requestPayload" in result, false);
        assert.equal("apiKey" in result.providerMetadata, false);
        assert.equal("baseUrl" in result.providerMetadata, false);
        assert.equal("processingLockedAt" in result.providerMetadata, false);
        assert.equal("failureReason" in result.providerMetadata, false);
        assert.equal("refundError" in result.providerMetadata, false);
        assert.equal(result.providerMetadata.hasRefundError, true);
        assert.equal(result.providerMetadata.aiRepairAttempted, true);
        assert.equal(result.providerMetadata.aiRepairSucceeded, true);
        assert.equal("aiRepairReason" in result.providerMetadata, false);
    });

    it("wires every Web and Console response endpoint through an explicit serializer", () => {
        for (const pattern of [
            /createProfile[\s\S]*?toPublicAstrologyProfile/,
            /listProfiles[\s\S]*?toPublicAstrologyProfile/,
            /profileDetail[\s\S]*?toPublicAstrologyProfile/,
            /updateProfile[\s\S]*?toPublicAstrologyProfile/,
            /private toPublicReport[\s\S]*?toPublicAstrologyReport/,
        ]) {
            assert.match(webControllerSource, pattern);
        }
        for (const pattern of [
            /profiles[\s\S]*?toConsoleAstrologyProfile/,
            /reports[\s\S]*?toConsoleAstrologyReport/,
            /reportDetail[\s\S]*?toConsoleAstrologyReport/,
        ]) {
            assert.match(consoleControllerSource, pattern);
        }
    });

    it("fails closed while generation status is loading or errored", () => {
        for (const gate of [isWebGenerationUnavailable]) {
            assert.equal(gate({ isPending: true, isError: false }), true);
            assert.equal(gate({ isPending: false, isError: true }), true);
            assert.equal(gate({ isPending: false, isError: false, canGenerate: false }), true);
            assert.equal(gate({ isPending: false, isError: false, canGenerate: true }), false);
        }
    });
});
