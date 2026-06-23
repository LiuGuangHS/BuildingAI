import type {
    ImageModelAllowedParams,
    ImageModelCapabilities,
    ImageModelDefaultParams,
    ImageModelEndpoint,
    ImageRequestContract,
} from "../../../db/entities/image-model-config.entity";

export const ECHOFLOW_IMAGE_MODEL = {
    GPT_IMAGE_1: "gpt-image-1",
    DALLE_3: "dall-e-3",
    DOUBAO_SEEDREAM_3: "doubao-seedream-3-0-t2i",
    OPENAI_COMPATIBLE_IMAGE: "openai-compatible-image",
} as const;

export const DEFAULT_IMAGE_GATEWAY_BASE_URL = "https://api.openai.com/v1";

export type EchoFlowImageModel =
    (typeof ECHOFLOW_IMAGE_MODEL)[keyof typeof ECHOFLOW_IMAGE_MODEL];

export interface BuiltInImageModelConfig {
    provider: "echoflow-api";
    model: EchoFlowImageModel;
    externalModelId: string;
    requestContract: ImageRequestContract;
    displayName: string;
    description: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: ImageModelCapabilities;
    defaultParams: ImageModelDefaultParams;
    allowedParams: ImageModelAllowedParams;
    endpoints: ImageModelEndpoint[];
    sortOrder: number;
}

const defaultEndpoint = (): ImageModelEndpoint[] => [
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

const baseCapabilities: ImageModelCapabilities = {
    textToImage: true,
    imageToImage: true,
    mask: false,
    multiReference: true,
    seed: false,
    negativePrompt: true,
    outputFormat: true,
    background: true,
    moderation: true,
    inputFidelity: false,
};

const baseAllowedParams: ImageModelAllowedParams = {
    sizes: ["1024x1024", "1024x1536", "1536x1024"],
    qualities: ["standard", "hd"],
    outputFormats: ["png", "jpeg", "webp"],
    maxImages: 1,
};

export const BUILT_IN_IMAGE_MODEL_CONFIGS: BuiltInImageModelConfig[] = [
    {
        provider: "echoflow-api",
        model: ECHOFLOW_IMAGE_MODEL.GPT_IMAGE_1,
        externalModelId: "gpt-image-1",
        requestContract: "responses",
        displayName: "GPT Image 1",
        description: "OpenAI Responses 图像生成模型，支持文生图与参考图生成",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            ...baseCapabilities,
            inputFidelity: true,
        },
        defaultParams: {
            size: "1024x1024",
            quality: "standard",
            n: 1,
            responseFormat: "b64_json",
            outputFormat: "png",
        },
        allowedParams: {
            ...baseAllowedParams,
            qualities: ["low", "medium", "high", "auto", "standard", "hd"],
        },
        endpoints: defaultEndpoint(),
        sortOrder: 100,
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_IMAGE_MODEL.DALLE_3,
        externalModelId: "dall-e-3",
        requestContract: "images",
        displayName: "DALL-E 3",
        description: "DALL-E 3 图像生成，按 Images API 接入",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            ...baseCapabilities,
            imageToImage: false,
            multiReference: false,
            background: false,
            moderation: false,
        },
        defaultParams: {
            size: "1024x1024",
            quality: "standard",
            n: 1,
            responseFormat: "b64_json",
            outputFormat: "png",
        },
        allowedParams: {
            ...baseAllowedParams,
            sizes: ["1024x1024", "1024x1792", "1792x1024"],
        },
        endpoints: defaultEndpoint(),
        sortOrder: 90,
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_IMAGE_MODEL.DOUBAO_SEEDREAM_3,
        externalModelId: "doubao-seedream-3-0-t2i",
        requestContract: "openai-compatible-images",
        displayName: "豆包 Seedream 3.0",
        description: "豆包 Seedream 图像生成，按 OpenAI-compatible Images 请求格式接入",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            ...baseCapabilities,
            inputFidelity: true,
        },
        defaultParams: {
            size: "1024x1024",
            quality: "standard",
            n: 1,
            responseFormat: "b64_json",
            outputFormat: "png",
        },
        allowedParams: baseAllowedParams,
        endpoints: defaultEndpoint(),
        sortOrder: 80,
    },
    {
        provider: "echoflow-api",
        model: ECHOFLOW_IMAGE_MODEL.OPENAI_COMPATIBLE_IMAGE,
        externalModelId: "gpt-image-1",
        requestContract: "responses",
        displayName: "通用 Responses 生图",
        description: "预留给 OpenAI-compatible Responses 图像生成渠道",
        enabled: true,
        visibleToUser: false,
        capabilities: baseCapabilities,
        defaultParams: {
            size: "1024x1024",
            quality: "standard",
            n: 1,
            responseFormat: "b64_json",
            outputFormat: "png",
        },
        allowedParams: baseAllowedParams,
        endpoints: defaultEndpoint(),
        sortOrder: 10,
    },
];

export function getBuiltInImageModel(model: string) {
    return BUILT_IN_IMAGE_MODEL_CONFIGS.find((config) => config.model === model);
}

export function isBuiltInImageModel(model: string) {
    return Boolean(getBuiltInImageModel(model));
}
