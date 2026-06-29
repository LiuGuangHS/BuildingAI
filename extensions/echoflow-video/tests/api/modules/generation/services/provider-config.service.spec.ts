/// <reference path="../../../jest-globals.d.ts" />

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
    listActiveLlmModels: jest.fn(),
};

function makeService(): ProviderConfigService {
    return new ProviderConfigService(mockConfigRepo as any, mockAuditRepo as any, mockAiModelService as any);
}

function makeConfig(overrides: Partial<VideoProviderConfig> = {}): VideoProviderConfig {
    return {
        id: "cfg-001",
        provider: "happyhorse",
        promptOptimizerEnabled: true,
        promptOptimizerAllowedModelIds: [],
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
    mockAiModelService.listActiveLlmModels.mockResolvedValue([
        {
            id: "11111111-1111-4111-8111-111111111111",
            name: "主站 LLM",
            model: "gpt-test",
            modelType: "llm",
            description: "测试模型",
            features: ["text"],
            isActive: true,
            billingRule: { prompt: 1 },
            provider: {
                id: "provider-001",
                name: "主站供应商",
                provider: "openai",
                isActive: true,
            },
        },
    ]);
});

describe("ProviderConfigService", () => {
    it("returns prompt optimizer config when no provider config exists", async () => {
        mockConfigRepo.findOne.mockResolvedValue(null);

        const result = await makeService().getConsoleConfig();

        expect(result).toMatchObject({
            provider: "happyhorse",
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "",
            promptOptimizerAllowedModelIds: [],
        });
        expect(result).not.toHaveProperty("webhookSecretId");
        expect(result).not.toHaveProperty("templates");
    });

    it("writes sanitized audit record with operator id on update", async () => {
        const existing = makeConfig();
        mockConfigRepo.findOne.mockResolvedValue(existing);
        mockConfigRepo.save.mockResolvedValue(existing);

        await makeService().updateConsoleConfig({ promptOptimizerEnabled: false }, "admin-001");

        expect(mockAuditRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "provider_config_updated",
                operatorId: "admin-001",
                snapshot: expect.objectContaining({
                    provider: "happyhorse",
                    promptOptimizerEnabled: false,
                    promptOptimizerAllowedModelIds: [],
                }),
            }),
        );
        expect(mockAuditRepo.save).toHaveBeenCalledWith(
            expect.not.objectContaining({
                snapshot: expect.objectContaining({ webhookSecretId: expect.anything() }),
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

    it("ignores removed prompt optimizer billing config even when service is called directly", async () => {
        mockConfigRepo.findOne.mockResolvedValue(makeConfig());
        mockConfigRepo.save.mockImplementation(async (value) => value);

        const result = await makeService().updateConsoleConfig({ promptOptimizerEstimatedTokens: 49 } as any);

        expect(result).not.toHaveProperty("promptOptimizerEstimatedTokens");
        expect(mockConfigRepo.save).toHaveBeenCalledWith(
            expect.not.objectContaining({
                promptOptimizerEstimatedTokens: expect.anything(),
            }),
        );
    });

    it("normalizes model pool without touching model endpoint credentials", async () => {
        const existing = makeConfig();
        mockConfigRepo.findOne.mockResolvedValue(existing);
        mockConfigRepo.save.mockImplementation(async (value) => value);

        await makeService().updateConsoleConfig({
            promptOptimizerAllowedModelIds: [
                "11111111-1111-4111-8111-111111111111",
                "11111111-1111-4111-8111-111111111111",
            ],
        });

        expect(mockConfigRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                promptOptimizerAllowedModelIds: ["11111111-1111-4111-8111-111111111111"],
            }),
        );
    });

    it("lists prompt optimizer models through the public AI model service", async () => {
        const result = await makeService().listPromptOptimizerModels();

        expect(mockAiModelService.listActiveLlmModels).toHaveBeenCalledWith(100);
        expect(result).toEqual([
            expect.objectContaining({
                id: "11111111-1111-4111-8111-111111111111",
                modelType: "llm",
                provider: expect.objectContaining({ provider: "openai" }),
            }),
        ]);
    });
});
