/// <reference path="../../../jest-globals.d.ts" />

import { VideoGenerationStatus } from "../../../../../src/api/db/entities/video-generation.entity";
import { GenerationService } from "../../../../../src/api/modules/generation/services/generation.service";
import { VideoGatewayClient } from "../../../../../src/api/modules/generation/services/video-gateway-client";

const mockSubmitTask = jest.fn(async () => ({
    taskId: "task-001",
    rawRequest: { prompt: "生成一个产品开场镜头" },
    rawResponse: { task_id: "task-001" },
}));
const mockPollTask = jest.fn();

jest.mock("../../../../../src/api/modules/generation/services/video-gateway-client", () => ({
    VideoGatewayClient: jest.fn().mockImplementation(() => ({
        submitTask: mockSubmitTask,
        pollTask: mockPollTask,
    })),
}));

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
    mockSubmitTask.mockResolvedValue({
        taskId: "task-001",
        rawRequest: { prompt: "生成一个产品开场镜头" },
        rawResponse: { task_id: "task-001" },
    });
    mockPollTask.mockResolvedValue({ status: "processing" });
    mockGenerationRepository.findOne.mockResolvedValue(null);
    mockGenerationRepository.save.mockImplementation(async (value) => value);
    mockBillingService.hasSufficientPower.mockResolvedValue(true);
    mockBillingService.hasBillingLog.mockResolvedValue(false);
    mockVideoPollQueue.add.mockResolvedValue(undefined);
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

describe("GenerationService queue handling", () => {
    it("fails and refunds the generation when initial poll scheduling fails", async () => {
        mockFileUploadService.findOneById.mockResolvedValue({
            id: "file-001",
            uploaderId: "current-user",
            extensionIdentifier: "echoflow-video",
            url: "https://cdn.example.com/uploads/first.png",
            size: 1024,
            mimeType: "image/png",
            originalName: "first.png",
        });
        mockGenerationRepository.findOne.mockResolvedValue({
            id: "generation-001",
            userId: "current-user",
            status: VideoGenerationStatus.PROCESSING,
            billingStatus: "deducted",
            billingAmount: 10,
            billingRuleSnapshot: { refundOnFailure: true },
            statusEvents: [],
        });
        mockVideoPollQueue.add.mockRejectedValue(new Error("redis down"));

        await expect(makeService().createAndSubmit({
            model: "happyhorse-1.0-i2v",
            prompt: "生成一个产品开场镜头",
            media: [{ type: "first_frame", fileId: "file-001", url: "https://example.com/ignored.png" }],
        }, "current-user")).rejects.toThrow("视频任务轮询入队失败");

        expect(mockBillingService.addUserPower).toHaveBeenCalledWith(expect.objectContaining({
            userId: "current-user",
            amount: 10,
            associationNo: "generation-001",
        }), expect.anything());
        expect(mockGenerationRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            id: "generation-001",
            status: VideoGenerationStatus.FAILED,
            failureCategory: "queue",
        }));
        expect(VideoGatewayClient).toHaveBeenCalled();
    });

    it("reschedules worker polling after a transient provider poll error", async () => {
        mockGenerationRepository.findOne.mockResolvedValue({
            id: "generation-001",
            userId: "current-user",
            model: "happyhorse-1.0-i2v",
            taskId: "task-001",
            status: VideoGenerationStatus.PROCESSING,
            billingStatus: "deducted",
            billingAmount: 10,
            billingRuleSnapshot: { refundOnFailure: true },
            progress: 35,
            statusEvents: [],
        });
        mockPollTask.mockRejectedValue(new Error("provider timeout"));

        await expect(makeService().pollAnyAndUpdate("generation-001", { scheduleNext: true })).resolves.toEqual(expect.objectContaining({
            id: "generation-001",
            status: VideoGenerationStatus.PROCESSING,
        }));

        expect(mockVideoPollQueue.add).toHaveBeenCalled();
        expect(mockBillingService.addUserPower).not.toHaveBeenCalled();
    });

    it("fails and refunds when follow-up polling cannot be scheduled", async () => {
        mockGenerationRepository.findOne.mockResolvedValue({
            id: "generation-001",
            userId: "current-user",
            model: "happyhorse-1.0-i2v",
            taskId: "task-001",
            status: VideoGenerationStatus.PROCESSING,
            billingStatus: "deducted",
            billingAmount: 10,
            billingRuleSnapshot: { refundOnFailure: true },
            progress: 35,
            statusEvents: [],
        });
        mockPollTask.mockResolvedValue({ status: "processing" });
        mockVideoPollQueue.add.mockRejectedValue(new Error("redis down"));

        await expect(makeService().pollAnyAndUpdate("generation-001", { scheduleNext: true })).rejects.toThrow("视频任务轮询入队失败");

        expect(mockBillingService.addUserPower).toHaveBeenCalledWith(expect.objectContaining({
            userId: "current-user",
            amount: 10,
            associationNo: "generation-001",
        }), expect.anything());
        expect(mockGenerationRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            id: "generation-001",
            status: VideoGenerationStatus.FAILED,
            failureCategory: "queue",
        }));
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

describe("GenerationService task recovery", () => {
    const staleProcessingRecord = {
        id: "generation-stale",
        userId: "user-001",
        taskId: "task-stale",
        status: VideoGenerationStatus.PROCESSING,
        updatedAt: new Date(Date.now() - 10 * 60_000),
        model: "happyhorse-1.0-i2v",
        billingStatus: "deducted",
        billingRuleSnapshot: { refundOnFailure: true },
        progress: 50,
        statusEvents: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockVideoPollQueue.add.mockResolvedValue(undefined);
        mockGenerationRepository.manager = {
            transaction: jest.fn(async (cb: (m: any) => Promise<any>) => {
                return cb({
                    query: jest.fn(),
                    findOne: mockGenerationRepository.findOne,
                    update: mockGenerationRepository.update,
                });
            }),
        };
    });

    it("reschedules poll jobs for stale PROCESSING records on startup", async () => {
        mockGenerationRepository.find.mockResolvedValue([staleProcessingRecord]);
        mockGenerationRepository.findOne.mockResolvedValue(staleProcessingRecord);
        mockGenerationRepository.update.mockResolvedValue({ affected: 1 });

        const service = makeService();
        await (service as any).recoverProcessingTasks();

        expect(mockVideoPollQueue.add).toHaveBeenCalledWith(
            "poll-video-generation",
            expect.objectContaining({ id: "generation-stale" }),
            expect.objectContaining({ delay: 0 }),
        );
    });

    it("skips records without taskId during recovery", async () => {
        mockGenerationRepository.find.mockResolvedValue([{
            ...staleProcessingRecord,
            taskId: null,
        }]);

        const service = makeService();
        await (service as any).recoverProcessingTasks();

        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });

    it("does not reschedule if claimPollForRecovery returns null (already claimed)", async () => {
        mockGenerationRepository.find.mockResolvedValue([staleProcessingRecord]);
        mockGenerationRepository.findOne.mockResolvedValue(null);

        const service = makeService();
        await (service as any).recoverProcessingTasks();

        expect(mockVideoPollQueue.add).not.toHaveBeenCalled();
    });
});
