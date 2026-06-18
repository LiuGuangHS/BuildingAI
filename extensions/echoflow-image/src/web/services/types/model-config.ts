export type ImageRequestContract = "responses" | "images" | "openai-compatible-images" | "provider-native";

export interface ImageModelEndpoint {
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

export type SaveModelEndpointParams = ImageModelEndpoint;

export interface ImageModelConfig {
    id: string;
    provider: string;
    model: string;
    externalModelId: string;
    requestContract: ImageRequestContract;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: Record<string, boolean>;
    defaultParams: Record<string, unknown>;
    allowedParams: {
        sizes?: string[];
        qualities?: string[];
        styles?: string[];
        outputFormats?: string[];
        maxImages?: number;
    };
    endpoints?: ImageModelEndpoint[];
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface SaveModelConfigParams {
    displayName?: string;
    description?: string;
    enabled?: boolean;
    visibleToUser?: boolean;
    defaultParams?: Record<string, unknown>;
    allowedParams?: Record<string, unknown>;
    endpoints?: SaveModelEndpointParams[];
    sortOrder?: number;
}
