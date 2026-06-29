export const ImageGenerationStatus = {
    PENDING: "pending",
    PROCESSING: "processing",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
} as const;

export type ImageGenerationStatus =
    (typeof ImageGenerationStatus)[keyof typeof ImageGenerationStatus];

export const ImageGenerationBillingStatus = {
    PENDING: "pending",
    DEDUCTED: "deducted",
    REFUNDED: "refunded",
    FAILED: "failed",
} as const;

export type ImageGenerationBillingStatus =
    (typeof ImageGenerationBillingStatus)[keyof typeof ImageGenerationBillingStatus];

export const ImageGenerationMode = {
    TEXT_TO_IMAGE: "text-to-image",
    IMAGE_TO_IMAGE: "image-to-image",
} as const;

export type ImageGenerationMode = (typeof ImageGenerationMode)[keyof typeof ImageGenerationMode];

export const ImageResponseFormat = {
    B64_JSON: "b64_json",
    URL: "url",
} as const;

export type ImageResponseFormat = (typeof ImageResponseFormat)[keyof typeof ImageResponseFormat];

export interface GeneratedImageRecord {
    url?: string;
    b64Json?: string;
    mimeType?: string;
    revisedPrompt?: string;
}

export interface ImageSourceRecord {
    url?: string;
    fileId?: string;
    mimeType?: string;
}

export interface ImageGeneration {
    id: string;
    mode: ImageGenerationMode;
    status: ImageGenerationStatus;
    billingStatus: ImageGenerationBillingStatus;
    requestKey?: string;
    prompt: string;
    negativePrompt?: string;
    referenceImageUrl?: string;
    referenceImageFileId?: string;
    sourceImages?: ImageSourceRecord[];
    maskImage?: ImageSourceRecord;
    modelId: string;
    modelName?: string;
    size: string;
    n: number;
    quality?: string;
    style?: string;
    responseFormat: ImageResponseFormat;
    resultImages: GeneratedImageRecord[];
    errorMessage?: string;
    billingAmount: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ConsoleImageGeneration extends ImageGeneration {
    userId: string;
    provider?: string;
    baseURL?: string;
}

export interface ImageModelOption {
    id: string;
    name: string;
    model: string;
    modelType?: string;
    apiMode?: "images" | "responses";
    requestPolicy?: "openai" | "compat";
    capabilities?: Record<string, boolean>;
    defaultParams?: Record<string, unknown>;
    allowedParams?: {
        sizes?: string[];
        qualities?: string[];
        styles?: string[];
        outputFormats?: string[];
        maxImages?: number;
    };
    features?: string[];
}

export interface QueryGenerationParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: ImageGenerationStatus;
    modelId?: string;
    mode?: ImageGenerationMode;
}

export interface CreateGenerationParams {
    prompt: string;
    negativePrompt?: string;
    referenceImageUrl?: string;
    referenceImageFileId?: string;
    sourceImages?: ImageSourceRecord[];
    maskImageUrl?: string;
    maskImageFileId?: string;
    modelId: string;
    size?: string;
    n?: number;
    quality?: string;
    style?: string;
    responseFormat?: ImageResponseFormat;
    mode?: ImageGenerationMode;
    requestKey?: string;
    outputFormat?: string;
    background?: string;
    outputCompression?: number;
    inputFidelity?: string;
    moderation?: string;
    seed?: string;
}

export interface PromptEnhanceParams {
    prompt: string;
    modelId: string;
    style?: string;
}

export interface PromptEnhanceResult {
    prompt: string;
    source: "ai";
}
