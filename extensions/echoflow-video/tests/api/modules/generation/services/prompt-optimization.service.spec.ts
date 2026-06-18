/// <reference path="../../../jest-globals.d.ts" />

jest.mock("@buildingai/ai-sdk", () => ({
    generateText: jest.fn(),
}));

import { generateText } from "@buildingai/ai-sdk";
import { PromptOptimizationService } from "../../../../../src/api/modules/generation/services/prompt-optimization.service";

const mockGenerateText = generateText as jest.Mock;

const mockProviderConfigService = {
    getConsoleConfig: jest.fn(),
};

const mockAiModelService = {
    getModelInfo: jest.fn(),
    getProviderConfig: jest.fn(),
    getProviderAdapter: jest.fn(),
};

const mockBillingService = {
    hasSufficientPower: jest.fn(),
    deductUserPower: jest.fn(),
    addUserPower: jest.fn(),
};

const mockOptimizationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
};

const mockAccountLogRepo = {
    exists: jest.fn(),
};

function makeService() {
    return new PromptOptimizationService(
        mockProviderConfigService as any,
        mockAiModelService as any,
        mockBillingService as any,
        mockOptimizationRepo as any,
        mockAccountLogRepo as any,
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockOptimizationRepo.create.mockImplementation((value) => value);
});

describe("PromptOptimizationService", () => {
    it("filters inactive prompt optimizer models and falls back defaultModelId", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            promptOptimizerAllowedModelIds: ["22222222-2222-4222-8222-222222222222"],
            promptOptimizerBillingEnabled: true,
        });
        mockAiModelService.getModelInfo.mockImplementation(async (id: string) => {
            if (id === "11111111-1111-4111-8111-111111111111") {
                return {
                    id,
                    name: "Disabled LLM",
                    model: "disabled-llm",
                    modelType: "llm",
                    isActive: false,
                    provider: { provider: "openai", isActive: true },
                };
            }

            return {
                id,
                name: "Usable LLM",
                model: "usable-llm",
                modelType: "llm",
                isActive: true,
                provider: { provider: "openai", isActive: true },
            };
        });

        const result = await makeService().getOptions();

        expect(result.defaultModelId).toBe("22222222-2222-4222-8222-222222222222");
        expect(result.models).toHaveLength(1);
        expect(result.models[0].id).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("falls back from an unusable default model to the first usable allowed model at runtime", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            promptOptimizerAllowedModelIds: ["22222222-2222-4222-8222-222222222222"],
            promptOptimizerBillingEnabled: false,
            promptOptimizerBillingPower: 1,
            promptOptimizerBillingTokens: 1000,
            promptOptimizerEstimatedTokens: 500,
        });
        mockAiModelService.getModelInfo.mockImplementation(async (id: string) => {
            if (id === "11111111-1111-4111-8111-111111111111") {
                return {
                    id,
                    name: "Disabled LLM",
                    model: "disabled-llm",
                    modelType: "llm",
                    isActive: false,
                    provider: { provider: "openai", isActive: true },
                };
            }

            return {
                id,
                name: "Usable LLM",
                model: "usable-llm",
                modelType: "llm",
                isActive: true,
                provider: { provider: "openai", isActive: true },
            };
        });
        mockAiModelService.getProviderConfig.mockResolvedValue({
            apiKey: { value: "sk-test" },
            baseURL: { value: "https://example.test/v1" },
        });
        const providerAdapter = Object.assign(
            jest.fn(() => ({ model: "adapter-model" })),
            { supports: jest.fn(() => true) },
        );
        mockAiModelService.getProviderAdapter.mockResolvedValue(providerAdapter);
        mockGenerateText.mockResolvedValue({
            text: "optimized video prompt",
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        });

        const result = await makeService().optimize({
            prompt: "一只产品在桌面旋转展示",
            style: "commercial",
        });

        expect(result.source).toBe("ai");
        expect(result.modelId).toBe("22222222-2222-4222-8222-222222222222");
        expect(result.optimizedPrompt).toBe("optimized video prompt");
        expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("does not fall back when the user explicitly selects an unusable optimizer model", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "22222222-2222-4222-8222-222222222222",
            promptOptimizerAllowedModelIds: ["11111111-1111-4111-8111-111111111111"],
            promptOptimizerBillingEnabled: false,
        });
        mockAiModelService.getModelInfo.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            name: "Disabled LLM",
            model: "disabled-llm",
            modelType: "llm",
            isActive: false,
            provider: { provider: "openai", isActive: true },
        });

        await expect(
            makeService().optimize({
                prompt: "一只产品在桌面旋转展示",
                modelId: "11111111-1111-4111-8111-111111111111",
            }),
        ).rejects.toThrow("提示词优化模型未启用或供应商未启用");

        expect(mockGenerateText).not.toHaveBeenCalled();
    });
});
