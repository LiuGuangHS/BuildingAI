/// <reference path="../../../jest-globals.d.ts" />

import { HappyHorseModel, VideoGenerationStatus } from "../../../../../src/api/db/entities/video-generation.entity";
import { ModelConfigService } from "../../../../../src/api/modules/generation/services/model-config.service";
import { ECHOFLOW_VIDEO_MODEL } from "../../../../../src/api/modules/generation/services/video-model-catalog";

const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
};

const mockGenerationRepository = {
    count: jest.fn(),
};

function makeEndpoint(overrides: Record<string, unknown> = {}) {
    return {
        id: "primary",
        name: "主接口",
        secretId: "secret-001",
        secretName: "测试密钥",
        baseUrlOverride: "https://api.echoflow.cn",
        enabled: true,
        priority: 100,
        requestTimeoutMs: 120000,
        testTimeoutMs: 15000,
        maxRetries: 2,
        retryDelayMs: 1000,
        ...overrides,
    };
}

const mockSecretService = {
    getConfigKeyValuePairs: jest.fn(),
};

function makeService() {
    return new ModelConfigService(mockRepository as any, mockGenerationRepository as any, mockSecretService as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.save.mockImplementation(async (value) => value);
    mockGenerationRepository.count.mockResolvedValue(0);
});

describe("ModelConfigService", () => {
    it("backfills fixed P0 models", async () => {
        mockRepository.find.mockResolvedValue([]);

        await makeService().list({ page: 1, pageSize: 20 });

        const savedModels = mockRepository.save.mock.calls[0][0].map((item: { model: string }) => item.model);
        expect(savedModels).toContain(ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0);
        expect(savedModels).toContain(ECHOFLOW_VIDEO_MODEL.KLING_IMAGE2VIDEO);
        expect(savedModels).toContain(HappyHorseModel.T2V);
    });

    it("does not show web models until a usable endpoint is configured", async () => {
        mockRepository.find.mockResolvedValue([]);

        const result = await makeService().listEnabledForWeb();

        expect(result).toEqual([]);
        expect(mockRepository.save).toHaveBeenCalled();
    });

    it("returns web models when endpoint has a secret binding", async () => {
        mockRepository.find.mockResolvedValue([
            {
                id: "model-seedance",
                provider: "echoflow-api",
                model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
                displayName: "Seedance",
                enabled: true,
                visibleToUser: true,
                capabilities: {},
                defaultParams: {},
                endpoints: [makeEndpoint()],
                sortOrder: 0,
            },
        ]);

        const result = await makeService().listEnabledForWeb();

        expect(result.map((item) => item.id)).toEqual([ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0]);
    });

    it("rejects a model that exists but is disabled by console", async () => {
        mockRepository.find.mockResolvedValue([
            {
                id: "model-seedance",
                provider: "echoflow-api",
                model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
                displayName: "Seedance",
                enabled: false,
                visibleToUser: true,
                capabilities: {},
                defaultParams: {},
                endpoints: [makeEndpoint()],
                sortOrder: 0,
            },
        ]);
        mockRepository.findOne.mockResolvedValue({
            provider: "echoflow-api",
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            enabled: false,
            visibleToUser: true,
        });

        await expect(makeService().findEnabledByModel(ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0)).rejects.toThrow("已在管理后台禁用");
    });

    it("rejects unknown models after console configs exist", async () => {
        mockRepository.find.mockResolvedValue([]);
        mockRepository.findOne.mockResolvedValue(null);

        await expect(makeService().findEnabledByModel("unknown-model")).rejects.toThrow("不支持的视频模型");
    });

    it("does not return unsupported historical configs from web options", async () => {
        mockRepository.find.mockResolvedValueOnce([
            {
                provider: "legacy-provider",
                model: "legacy-video",
                displayName: "Legacy Video",
                enabled: true,
                visibleToUser: true,
                capabilities: {},
                defaultParams: {},
                endpoints: [makeEndpoint()],
                sortOrder: 0,
            },
        ]);

        const result = await makeService().listEnabledForWeb();

        expect(result).toEqual([]);
        expect(mockRepository.save).toHaveBeenCalled();
    });

    it("does not allow creating arbitrary models", async () => {
        await expect(makeService().createConfig({
            provider: "other",
            model: "other-video",
            displayName: "Other",
        })).rejects.toThrow("内置目录");
    });

    it("keeps protocol fields fixed and saves model endpoints", async () => {
        mockRepository.findOne.mockResolvedValue({
            id: "model-seedance",
            provider: "echoflow-api",
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            displayName: "Seedance",
            enabled: true,
            visibleToUser: true,
            capabilities: { abilityTypes: ["text_to_video"] },
            defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
            endpoints: [makeEndpoint({ secretId: "old-secret" })],
            sortOrder: 10,
        });

        await makeService().updateConfig("model-seedance", {
            provider: "other",
            model: "other-video",
            displayName: "运营名",
            defaultParams: { duration: 999, resolution: "bad", ratio: "bad", watermark: false },
            endpoints: [makeEndpoint({ secretId: "new-secret" })],
        });

        expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            provider: "echoflow-api",
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            displayName: "运营名",
            defaultParams: expect.objectContaining({
                duration: 5,
                resolution: "720P",
                ratio: "16:9",
                watermark: false,
            }),
            endpoints: [expect.objectContaining({
                secretId: "new-secret",
                baseUrlOverride: "https://api.echoflow.cn",
                enabled: true,
            })],
        }));
    });

    it("strips historical endpoint display fields from operational views", async () => {
        mockRepository.find.mockResolvedValue([{
            id: "model-seedance",
            provider: "echoflow-api",
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            displayName: "Seedance",
            enabled: true,
            visibleToUser: true,
            capabilities: { abilityTypes: ["text_to_video"] },
            defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
            endpoints: [{
                id: "endpoint-1",
                name: "主接口",
                secretId: "secret-001",
                secretName: "测试密钥",
                baseUrlOverride: "https://api.echoflow.cn",
                enabled: true,
                priority: 100,
                requestTimeoutMs: 120000,
                testTimeoutMs: 15000,
                maxRetries: 2,
                retryDelayMs: 1000,
                apiKeyMasked: "legacy-mask",
            }],
            sortOrder: 10,
        } as any]);

        const result = await makeService().list({ page: 1, pageSize: 20 });
        const model = result.items.find((item) => item.model === ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0);
        expect(model).toBeTruthy();
        const endpoint = model?.endpoints?.[0] as Record<string, unknown>;

        expect(endpoint).not.toHaveProperty("apiKeyMasked");
        expect(endpoint).toMatchObject({
            id: "endpoint-1",
            name: "主接口",
            secretId: "secret-001",
            secretName: "测试密钥",
            baseUrlOverride: "https://api.echoflow.cn",
        });
    });

    it("rejects disabling or hiding models while they have active generations", async () => {
        mockRepository.findOne.mockResolvedValue({
            id: "model-seedance",
            provider: "echoflow-api",
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            displayName: "Seedance",
            enabled: true,
            visibleToUser: true,
            capabilities: { abilityTypes: ["text_to_video"] },
            defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
            endpoints: [makeEndpoint()],
            sortOrder: 10,
        });
        mockGenerationRepository.count.mockResolvedValue(1);

        await expect(makeService().updateConfig("model-seedance", { enabled: false })).rejects.toThrow("仍有视频任务处理中");
        await expect(makeService().updateConfig("model-seedance", { visibleToUser: false })).rejects.toThrow("仍有视频任务处理中");
        await expect(makeService().updateConfig("model-seedance", {
            endpoints: [makeEndpoint({ enabled: false })],
        })).rejects.toThrow("仍有视频任务处理中");

        expect(mockGenerationRepository.count).toHaveBeenCalledWith({
            where: {
                modelConfigId: "model-seedance",
                status: expect.anything(),
            },
        });
        expect(mockRepository.save).not.toHaveBeenCalled();
    });
});
