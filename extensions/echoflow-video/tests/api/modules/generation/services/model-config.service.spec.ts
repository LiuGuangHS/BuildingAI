/// <reference path="../../../jest-globals.d.ts" />

import { HappyHorseModel } from "../../../../../src/api/db/entities/video-generation.entity";
import { ModelConfigService } from "../../../../../src/api/modules/generation/services/model-config.service";

const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
};

function makeService() {
    return new ModelConfigService(mockRepository as any);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe("ModelConfigService", () => {
    it("uses default models only before any console model config exists", async () => {
        mockRepository.find.mockResolvedValue([]);
        mockRepository.count.mockResolvedValue(0);

        const result = await makeService().listEnabledForWeb();

        expect(result.map((item) => item.id)).toContain(HappyHorseModel.T2V);
    });

    it("returns no web models when console configs exist but all are disabled or hidden", async () => {
        mockRepository.find.mockResolvedValue([]);
        mockRepository.count.mockResolvedValue(4);

        const result = await makeService().listEnabledForWeb();

        expect(result).toEqual([]);
    });

    it("rejects a model that exists but is disabled by console", async () => {
        mockRepository.findOne.mockResolvedValue({
            model: HappyHorseModel.T2V,
            enabled: false,
            visibleToUser: true,
        });

        await expect(makeService().findEnabledByModel(HappyHorseModel.T2V)).rejects.toThrow("已在管理后台禁用");
    });

    it("rejects unknown models after console configs exist", async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(1);

        await expect(makeService().findEnabledByModel("unknown-model")).rejects.toThrow("不支持的视频模型");
    });
});
