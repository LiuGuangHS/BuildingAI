/// <reference path="../../../jest-globals.d.ts" />

import { PromptOptimizationService } from "../../../../../src/api/modules/generation/services/prompt-optimization.service";

const mockProviderConfigService = {
    getConsoleConfig: jest.fn(),
};

const mockAiModelService = {
    getModelInfo: jest.fn(),
    generateText: jest.fn(),
};

const mockBillingService = {
    hasSufficientPower: jest.fn(),
    deductUserPower: jest.fn(),
    addUserPower: jest.fn(),
    hasBillingLog: jest.fn(),
};

const mockOptimizationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
};

function makeService() {
    return new PromptOptimizationService(
        mockProviderConfigService as any,
        mockAiModelService as any,
        mockBillingService as any,
        mockOptimizationRepo as any,
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockOptimizationRepo.create.mockImplementation((value) => value);
    mockOptimizationRepo.save.mockImplementation(async (value) => ({ id: "prompt-opt-001", ...value }));
    mockAiModelService.generateText.mockResolvedValue({
        text: "optimized video prompt",
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
    } as any);
});

describe("PromptOptimizationService", () => {
    it("filters inactive prompt optimizer models and falls back defaultModelId", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            promptOptimizerAllowedModelIds: ["22222222-2222-4222-8222-222222222222"],
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
                billingRule: { power: 1, tokens: 1000 },
            };
        });
        mockAiModelService.generateText.mockResolvedValue({
            text: "optimized video prompt",
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        } as any);

        const result = await makeService().optimize({
            prompt: "一只产品在桌面旋转展示",
            style: "commercial",
        });

        expect(result.source).toBe("ai");
        expect(result.modelId).toBe("22222222-2222-4222-8222-222222222222");
        expect(result.optimizedPrompt).toBe("optimized video prompt");
        expect(mockAiModelService.generateText).toHaveBeenCalledTimes(1);
    });

    it("calls text generation through the main-system extension SDK service", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            promptOptimizerAllowedModelIds: [],
        });
        mockAiModelService.getModelInfo.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            name: "Main LLM",
            model: "main-llm",
            modelType: "llm",
            isActive: true,
            provider: { provider: "openai", isActive: true },
        });
        mockAiModelService.generateText.mockResolvedValue({
            text: "optimized video prompt",
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        } as any);

        await makeService().optimize({
            prompt: "一只产品在桌面旋转展示",
            style: "commercial",
        });

        expect(mockAiModelService.generateText).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.objectContaining({
            system: expect.stringContaining("professional AI video prompt director"),
            prompt: expect.stringContaining("Original prompt"),
        }));
    });

    it("does not fall back when the user explicitly selects an unusable optimizer model", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "22222222-2222-4222-8222-222222222222",
            promptOptimizerAllowedModelIds: ["11111111-1111-4111-8111-111111111111"],
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

        expect(mockAiModelService.generateText).not.toHaveBeenCalled();
    });

    it("does not invent plugin fallback billing when the main-system model has no billing rule", async () => {
        mockProviderConfigService.getConsoleConfig.mockResolvedValue({
            promptOptimizerEnabled: true,
            promptOptimizerModelId: "11111111-1111-4111-8111-111111111111",
            promptOptimizerAllowedModelIds: [],
        });
        mockAiModelService.getModelInfo.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            name: "Main LLM",
            model: "main-llm",
            modelType: "llm",
            isActive: true,
            provider: { provider: "openai", isActive: true },
        });
        mockAiModelService.generateText.mockResolvedValue({
            text: "optimized video prompt",
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        } as any);

        const result = await makeService().optimize({
            prompt: "一只产品在桌面旋转展示",
            style: "commercial",
        }, "user-001");

        expect(result.source).toBe("ai");
        expect(result.consumedPower).toBe(0);
        expect(mockBillingService.hasSufficientPower).not.toHaveBeenCalled();
        expect(mockBillingService.deductUserPower).not.toHaveBeenCalled();
    });
});
