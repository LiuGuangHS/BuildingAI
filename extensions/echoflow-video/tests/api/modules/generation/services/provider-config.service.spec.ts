/// <reference path="../../../jest-globals.d.ts" />

import { encryptApiKey } from "../../../../../src/api/common/crypto/encryption";
import { VideoProviderConfig } from "../../../../../src/api/db/entities/video-provider-config.entity";
import { ProviderConfigService } from "../../../../../src/api/modules/generation/services/provider-config.service";

const mockConfigRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((value) => value),
};

const mockAuditRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    find: jest.fn(),
};

const mockAiModelService = {
    getModelInfo: jest.fn(),
};

function makeService(): ProviderConfigService {
    return new ProviderConfigService(mockConfigRepo as any, mockAuditRepo as any, mockAiModelService as any);
}

function makeConfig(overrides: Partial<VideoProviderConfig> = {}): VideoProviderConfig {
    return {
        id: "cfg-001",
        provider: "happyhorse",
        apiKey: encryptApiKey("sk-test-key-12345678"),
        baseUrl: "https://api.echoflow.cn",
        requestTimeoutMs: 120000,
        testTimeoutMs: 15000,
        maxRetries: 2,
        retryDelayMs: 1000,
        enabled: true,
        templates: [],
        promptOptimizerEnabled: true,
        promptOptimizerAllowedModelIds: [],
        promptOptimizerBillingEnabled: true,
        promptOptimizerBillingPower: 1,
        promptOptimizerBillingTokens: 1000,
        promptOptimizerEstimatedTokens: 500,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAiModelService.getModelInfo.mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        modelType: "llm",
        isActive: true,
        provider: { isActive: true },
    });
});

describe("ProviderConfigService", () => {
    it("returns full empty console config when no provider config exists", async () => {
        mockConfigRepo.findOne.mockResolvedValue(null);

        const result = await makeService().getConsoleConfig();

        expect(result).toMatchObject({
            provider: "happyhorse",
            enabled: false,
            configured: false,
            apiKeyMasked: "",
            webhookSecretConfigured: false,
            promptOptimizerEnabled: true,
        });
    });

    it("requires a configured webhook secret before trusting public callbacks", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig({ webhookSecret: undefined }));

        const verified = await makeService().verifyHappyHorseWebhookSecret(undefined);

        expect(verified).toBe(false);
    });

    it("verifies webhook secret when configured", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig({ webhookSecret: encryptApiKey("secret-123") }));

        await expect(makeService().verifyHappyHorseWebhookSecret("secret-123")).resolves.toBe(true);
        await expect(makeService().verifyHappyHorseWebhookSecret("wrong")).resolves.toBe(false);
    });

    it("writes sanitized audit record with operator id on update", async () => {
        const existing = makeConfig();
        mockConfigRepo.findOne.mockResolvedValue(existing);
        mockConfigRepo.save.mockResolvedValue(existing);

        await makeService().updateConsoleConfig({ enabled: false }, "admin-001");

        expect(mockAuditRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "provider_config_updated",
                operatorId: "admin-001",
                snapshot: expect.objectContaining({
                    configured: true,
                    webhookSecretConfigured: false,
                }),
            }),
        );
    });

    it("rejects inactive prompt optimizer models on update", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig());
        mockAiModelService.getModelInfo.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            modelType: "llm",
            isActive: false,
            provider: { isActive: true },
        });

        await expect(
            makeService().updateConsoleConfig({
                promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            }),
        ).rejects.toThrow("默认提示词优化模型未启用或供应商未启用");
    });

    it("rejects non-LLM prompt optimizer model pool entries", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig());
        mockAiModelService.getModelInfo.mockResolvedValue({
            id: "22222222-2222-4222-8222-222222222222",
            modelType: "text-to-image",
            isActive: true,
            provider: { isActive: true },
        });

        await expect(
            makeService().updateConsoleConfig({
                promptOptimizerAllowedModelIds: ["22222222-2222-4222-8222-222222222222"],
            }),
        ).rejects.toThrow("提示词优化模型池必须选择 LLM 文本模型");
    });

    it("rejects invalid runtime numeric config even when service is called directly", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig());

        await expect(
            makeService().updateConsoleConfig({ maxRetries: 99 }),
        ).rejects.toThrow("重试次数必须是 0 到 5 之间的整数");
    });

    it("rejects private HappyHorse base URLs", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig());

        await expect(
            makeService().updateConsoleConfig({ baseUrl: "http://127.0.0.1:8080" }),
        ).rejects.toThrow("本机或内网");
    });
});
