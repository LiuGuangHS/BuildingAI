import { HappyHorseModel } from "../../../db/entities/video-generation.entity";
import type {
    VideoAbilityType,
    VideoMediaType,
    VideoModelCapabilities,
    VideoModelDefaultParams,
} from "../../../db/entities/video-model-config.entity";

export const ECHOFLOW_VIDEO_MODEL = {
    SEEDANCE_1_5_PRO: "doubao-seedance-1-5-pro-251215",
    SEEDANCE_2_0: "doubao-seedance-2-0-260128",
    KLING_TEXT2VIDEO: "kling-text2video",
    KLING_IMAGE2VIDEO: "kling-image2video",
    KLING_MULTI_IMAGE2VIDEO: "kling-multi-image2video",
    HAPPYHORSE_I2V: HappyHorseModel.I2V,
    HAPPYHORSE_R2V: HappyHorseModel.R2V,
    HAPPYHORSE_T2V: HappyHorseModel.T2V,
    HAPPYHORSE_VIDEO_EDIT: HappyHorseModel.VIDEO_EDIT,
} as const;

export type EchoFlowVideoModel =
    (typeof ECHOFLOW_VIDEO_MODEL)[keyof typeof ECHOFLOW_VIDEO_MODEL];

export const DEFAULT_VIDEO_GATEWAY_BASE_URL = "https://api.echoflow.cn";

export interface VideoModelEndpointConfig {
    id?: string;
    name: string;
    secretId?: string;
    secretName?: string;
    baseUrlOverride?: string;
    enabled: boolean;
    priority: number;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

export interface BuiltInVideoModelConfig {
    provider: "echoflow-api";
    model: EchoFlowVideoModel;
    externalModelId: string;
    displayName: string;
    description: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: VideoModelCapabilities;
    defaultParams: VideoModelDefaultParams;
    sortOrder: number;
    submitPath: string;
    pollPath: string;
    endpoints: VideoModelEndpointConfig[];
}

const defaultEndpoint = (): VideoModelEndpointConfig[] => [
    {
        id: "primary",
        name: "主接口",
        enabled: false,
        priority: 100,
        requestTimeoutMs: 120_000,
        testTimeoutMs: 15_000,
        maxRetries: 2,
        retryDelayMs: 1_000,
    },
];

function capabilities(
    abilityTypes: VideoAbilityType[],
    mediaTypes: VideoMediaType[],
    overrides: Partial<VideoModelCapabilities> = {},
): VideoModelCapabilities {
    return {
        abilityTypes,
        mediaTypes,
        duration: { allowedValues: [5, 10] },
        resolutions: ["720P", "1080P"],
        ratios: ["16:9", "9:16", "1:1"],
        fps: 24,
        format: "mp4",
        apiContractVerified: true,
        ...overrides,
    };
}

export const BUILT_IN_VIDEO_MODEL_CONFIGS: BuiltInVideoModelConfig[] = [
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
        externalModelId: ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0,
        displayName: "豆包 Seedance 2.0",
        description: "豆包 Seedance 2.0 视频生成，支持文本和图片输入",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(
            ["text_to_video", "first_frame_i2v", "reference_to_video", "native_audio"],
            ["first_frame", "reference_image"],
        ),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 90,
        submitPath: "/api/v3/contents/generations/tasks",
        pollPath: "/api/v3/contents/generations/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.SEEDANCE_1_5_PRO,
        externalModelId: ECHOFLOW_VIDEO_MODEL.SEEDANCE_1_5_PRO,
        displayName: "豆包 Seedance 1.5 Pro",
        description: "豆包 Seedance 1.5 Pro 视频生成",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["text_to_video", "first_frame_i2v"], ["first_frame"]),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 80,
        submitPath: "/volc/v1/contents/generations/tasks",
        pollPath: "/volc/v1/contents/generations/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.KLING_TEXT2VIDEO,
        externalModelId: "kling-v2-1-master",
        displayName: "可灵文生视频",
        description: "可灵文生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["text_to_video"], [], { duration: { allowedValues: [5, 10] } }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 70,
        submitPath: "/kling/v1/videos/text2video",
        pollPath: "/kling/v1/videos/text2video/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.KLING_IMAGE2VIDEO,
        externalModelId: "kling-v2-1-master",
        displayName: "可灵图生视频",
        description: "可灵首帧图生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["first_frame_i2v"], ["first_frame"], { duration: { allowedValues: [5, 10] } }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 60,
        submitPath: "/kling/v1/videos/image2video",
        pollPath: "/kling/v1/videos/image2video/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.KLING_MULTI_IMAGE2VIDEO,
        externalModelId: "kling-v1-6",
        displayName: "可灵多图参考生视频",
        description: "可灵多图参考生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["reference_to_video"], ["reference_image"], { duration: { allowedValues: [5, 10] } }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 50,
        submitPath: "/kling/v1/videos/multi-image2video",
        pollPath: "/kling/v1/videos/multi-image2video/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_T2V,
        externalModelId: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_T2V,
        displayName: "HappyHorse 文生视频",
        description: "HappyHorse 文生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["text_to_video", "native_audio"], [], { duration: { min: 3, max: 15 } }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 40,
        submitPath: "/alibailian/api/v1/services/aigc/video-generation/video-synthesis",
        pollPath: "/alibailian/api/v1/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_I2V,
        externalModelId: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_I2V,
        displayName: "HappyHorse 图生视频",
        description: "HappyHorse 首帧图生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["first_frame_i2v", "native_audio"], ["first_frame"], { duration: { min: 3, max: 15 } }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 30,
        submitPath: "/alibailian/api/v1/services/aigc/video-generation/video-synthesis",
        pollPath: "/alibailian/api/v1/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_R2V,
        externalModelId: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_R2V,
        displayName: "HappyHorse 参考图生视频",
        description: "HappyHorse 参考图生视频模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["reference_to_video", "digital_human", "native_audio"], ["reference_image"], { duration: { min: 3, max: 15 }, ratios: ["16:9", "9:16", "1:1", "3:4", "4:3"] }),
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 20,
        submitPath: "/alibailian/api/v1/services/aigc/video-generation/video-synthesis",
        pollPath: "/alibailian/api/v1/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_VIDEO_EDIT,
        externalModelId: ECHOFLOW_VIDEO_MODEL.HAPPYHORSE_VIDEO_EDIT,
        displayName: "HappyHorse 视频编辑",
        description: "HappyHorse 视频编辑模型",
        enabled: true,
        visibleToUser: true,
        capabilities: capabilities(["video_editing", "action_transfer", "native_audio"], ["video", "reference_image"], { duration: { min: 3, max: 15 }, ratios: [] }),
        defaultParams: { duration: 5, resolution: "720P", watermark: true },
        sortOrder: 10,
        submitPath: "/alibailian/api/v1/services/aigc/video-generation/video-synthesis",
        pollPath: "/alibailian/api/v1/tasks/{id}",
        endpoints: defaultEndpoint(),
    },
];

export function getBuiltInVideoModel(model: string) {
    return BUILT_IN_VIDEO_MODEL_CONFIGS.find((config) => config.model === model);
}

export function isBuiltInVideoModel(model: string) {
    return Boolean(getBuiltInVideoModel(model));
}
