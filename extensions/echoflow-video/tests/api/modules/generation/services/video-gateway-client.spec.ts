/// <reference path="../../../jest-globals.d.ts" />

import { VideoGatewayClient } from "../../../../../src/api/modules/generation/services/video-gateway-client";
import { ECHOFLOW_VIDEO_MODEL, getBuiltInVideoModel } from "../../../../../src/api/modules/generation/services/video-model-catalog";

const fetchMock = jest.fn();

global.fetch = fetchMock as any;

function makeClient(model: string) {
    const builtIn = getBuiltInVideoModel(model);
    if (!builtIn) throw new Error(`missing model ${model}`);
    return new VideoGatewayClient(
        {
            id: "model-id",
            provider: builtIn.provider,
            model: builtIn.model,
            externalModelId: builtIn.externalModelId,
            displayName: builtIn.displayName,
            description: builtIn.description,
            enabled: true,
            visibleToUser: true,
            capabilities: builtIn.capabilities,
            defaultParams: builtIn.defaultParams,
            endpoints: [],
            submitPath: builtIn.submitPath,
            pollPath: builtIn.pollPath,
            sortOrder: builtIn.sortOrder,
        },
        {
            id: "primary",
            name: "主接口",
            baseUrl: "https://api.echoflow.cn",
            enabled: true,
            priority: 100,
            requestTimeoutMs: 3000,
            testTimeoutMs: 3000,
            maxRetries: 0,
            retryDelayMs: 100,
        },
        "test-key",
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "task-1", status: "succeeded", content: { video_url: "https://cdn.example.com/v.mp4" } }),
    });
});

describe("VideoGatewayClient", () => {
    it("builds Seedance 2.0 text request without forcing media", async () => {
        const client = makeClient(ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0);

        await client.submitTask({
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            prompt: "一只猫在城市夜景里奔跑",
            media: [],
            parameters: { duration: 5, ratio: "16:9", watermark: true },
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.echoflow.cn/api/v3/contents/generations/tasks");
        expect(body).toMatchObject({
            model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
            generate_audio: true,
            ratio: "16:9",
            duration: 5,
            watermark: true,
        });
        expect(body.content).toEqual([{ type: "text", text: "一只猫在城市夜景里奔跑", role: "user" }]);
    });

    it("builds Kling image2video request with first frame URL", async () => {
        const client = makeClient(ECHOFLOW_VIDEO_MODEL.KLING_IMAGE2VIDEO);

        await client.submitTask({
            model: ECHOFLOW_VIDEO_MODEL.KLING_IMAGE2VIDEO,
            prompt: "让图片里的产品旋转展示",
            media: [{ type: "first_frame", url: "https://cdn.example.com/first.png", fileId: "file-1" }],
            parameters: { duration: 5, watermark: false },
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.echoflow.cn/kling/v1/videos/image2video");
        expect(body).toMatchObject({
            image: "https://cdn.example.com/first.png",
            prompt: "让图片里的产品旋转展示",
            mode: "std",
            duration: "5",
            watermark_info: { enabled: false },
        });
    });

    it("extracts video url when polling task", async () => {
        const client = makeClient(ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0);

        const result = await client.pollTask("task-1");

        expect(fetchMock.mock.calls[0][0]).toBe("https://api.echoflow.cn/api/v3/contents/generations/tasks/task-1");
        expect(result).toMatchObject({
            status: "succeeded",
            videoUrl: "https://cdn.example.com/v.mp4",
        });
    });
});
