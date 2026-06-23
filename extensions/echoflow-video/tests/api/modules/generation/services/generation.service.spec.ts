/// <reference path="../../../jest-globals.d.ts" />

import { VideoGenerationStatus } from "../../../../../src/api/db/entities/video-generation.entity";
import { GenerationService } from "../../../../../src/api/modules/generation/services/generation.service";

const mockGenerationRepository = {
    create: jest.fn((value) => ({ id: "generation-001", ...value })),
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    find: jest.fn(),
};

const mockFileUploadService = {
    findOneById: jest.fn(),
};

const mockBillingService = {
    hasSufficientPower: jest.fn(),
    hasBillingLog: jest.fn(),
    addUserPower: jest.fn(),
    deductUserPower: jest.fn(),
};

const mockProviderConfigService = {};

const mockModelConfigService = {
    findEnabledByModel: jest.fn(),
    resolveRuntimeEndpoint: jest.fn(),
};

const mockBillingRuleService = {
    calculateAmount: jest.fn(),
    resolveRule: jest.fn(),
};

const mockPolicyService = {
    validateGeneration: jest.fn(),
};

const mockNotificationService = {
    registerScenes: jest.fn(),
    notifyUser: jest.fn(),
};

const mockVideoPollQueue = {
    add: jest.fn(),
};

function makeService() {
    return new GenerationService(
        mockGenerationRepository as any,
        mockFileUploadService as any,
        mockBillingService as any,
        mockProviderConfigService as any,
        mockModelConfigService as any,
        mockBillingRuleService as any,
        mockPolicyService as any,
        mockNotificationService as any,
        mockVideoPollQueue as any,
    );
}

function makeModelConfig(overrides: Record<string, unknown> = {}) {
    return {
        id: "model-001",
        model: "happyhorse-1.0-i2v",
        provider: "happyhorse",
        displayName: "图生视频",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            mediaTypes: ["first_frame"],
            abilityTypes: ["first_frame_i2v"],
        },
        defaultParams: {
            duration: 5,
            resolution: "720P",
            ratio: "16:9",
            watermark: true,
        },
        endpoints: [],
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGenerationRepository.findOne.mockResolvedValue(null);
    mockBillingService.hasSufficientPower.mockResolvedValue(true);
    mockModelConfigService.findEnabledByModel.mockResolvedValue(makeModelConfig());
    mockModelConfigService.resolveRuntimeEndpoint.mockResolvedValue({
        endpoint: { id: "endpoint-001" },
        apiKey: "test-key",
        baseUrl: "https://provider.example.com",
    });
    mockBillingRuleService.calculateAmount.mockResolvedValue(10);
    mockBillingRuleService.resolveRule.mockResolvedValue({
        id: "rule-001",
        baseCost: 10,
        perSecondCost: 0,
        resolutionMultipliers: {},
        minimumCost: 0,
        refundOnFailure: true,
    });
});

describe("GenerationService media validation", () => {
    it("rejects uploaded media owned by another user before billing or provider submission", async () => {
        mockFileUploadService.findOneById.mockResolvedValue({
            id: "file-001",
            uploaderId: "other-user",
            extensionIdentifier: "echoflow-video",
            url: "https://cdn.example.com/uploads/first.png",
            size: 1024,
            mimeType: "image/png",
            originalName: "first.png",
        });

        await expect(makeService().createAndSubmit({
            model: "happyhorse-1.0-i2v",
            prompt: "生成一个产品开场镜头",
            media: [{ type: "first_frame", fileId: "file-001", url: "https://example.com/ignored.png" }],
        }, "current-user")).rejects.toThrow("媒体素材不属于当前用户");

        expect(mockBillingService.hasSufficientPower).not.toHaveBeenCalled();
        expect(mockGenerationRepository.save).not.toHaveBeenCalled();
        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });

    it("rejects soft-deleted uploaded media before billing or provider submission", async () => {
        mockFileUploadService.findOneById.mockResolvedValue({
            id: "file-001",
            uploaderId: "current-user",
            extensionIdentifier: "echoflow-video",
            url: "https://cdn.example.com/uploads/first.png",
            size: 1024,
            mimeType: "image/png",
            originalName: "first.png",
            deletedAt: new Date("2026-06-20T00:00:00.000Z"),
        });

        await expect(makeService().createAndSubmit({
            model: "happyhorse-1.0-i2v",
            prompt: "生成一个产品开场镜头",
            media: [{ type: "first_frame", fileId: "file-001", url: "https://example.com/ignored.png" }],
        }, "current-user")).rejects.toThrow("媒体素材文件已删除");

        expect(mockBillingService.hasSufficientPower).not.toHaveBeenCalled();
        expect(mockGenerationRepository.save).not.toHaveBeenCalled();
        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });

    it("rejects uploaded media with the wrong MIME type before billing or provider submission", async () => {
        mockFileUploadService.findOneById.mockResolvedValue({
            id: "file-001",
            uploaderId: "current-user",
            extensionIdentifier: "echoflow-video",
            url: "https://cdn.example.com/uploads/not-image.txt",
            size: 1024,
            mimeType: "text/plain",
            originalName: "not-image.txt",
        });

        await expect(makeService().createAndSubmit({
            model: "happyhorse-1.0-i2v",
            prompt: "生成一个产品开场镜头",
            media: [{ type: "first_frame", fileId: "file-001", url: "https://example.com/ignored.txt" }],
        }, "current-user")).rejects.toThrow("图片素材的文件类型不正确");

        expect(mockBillingService.hasSufficientPower).not.toHaveBeenCalled();
        expect(mockGenerationRepository.save).not.toHaveBeenCalled();
        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });

    it("rejects uploaded media larger than the plugin limit before billing or provider submission", async () => {
        mockFileUploadService.findOneById.mockResolvedValue({
            id: "file-001",
            uploaderId: "current-user",
            extensionIdentifier: "echoflow-video",
            url: "https://cdn.example.com/uploads/huge.png",
            size: 1024 * 1024 * 1024 + 1,
            mimeType: "image/png",
            originalName: "huge.png",
        });

        await expect(makeService().createAndSubmit({
            model: "happyhorse-1.0-i2v",
            prompt: "生成一个产品开场镜头",
            media: [{ type: "first_frame", fileId: "file-001", url: "https://example.com/ignored.png" }],
        }, "current-user")).rejects.toThrow("媒体素材不能超过 1GB");

        expect(mockBillingService.hasSufficientPower).not.toHaveBeenCalled();
        expect(mockGenerationRepository.save).not.toHaveBeenCalled();
        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });
});
