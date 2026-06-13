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

function makeService(): ProviderConfigService {
    return new ProviderConfigService(mockConfigRepo as any, mockAuditRepo as any);
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
});
