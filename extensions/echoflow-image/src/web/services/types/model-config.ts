export interface ImageModelConfig {
    id: string;
    aiModelId: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    apiMode: "images" | "responses";
    responsesTransport: "sse" | "websocket" | "auto";
    requestPolicy: "openai" | "compat";
    capabilities: Record<string, boolean>;
    defaultParams: Record<string, unknown>;
    allowedParams: {
        sizes?: string[];
        qualities?: string[];
        styles?: string[];
        outputFormats?: string[];
        maxImages?: number;
    };
    sortOrder: number;
    aiModel?: {
        id: string;
        name: string;
        model: string;
        modelType?: string;
        isActive?: boolean;
        provider?: {
            name?: string;
            provider?: string;
            isActive?: boolean;
        };
    };
    createdAt: string;
    updatedAt: string;
}

export interface AvailableAiModelOption {
    id: string;
    name: string;
    model: string;
    modelType?: string;
    description?: string;
    features?: string[];
    isActive?: boolean;
    configured?: boolean;
    provider?: {
        id: string;
        name?: string;
        provider?: string;
        isActive?: boolean;
    };
}

export interface SaveModelConfigParams {
    aiModelId?: string;
    displayName?: string;
    description?: string;
    enabled?: boolean;
    apiMode?: "images" | "responses";
    responsesTransport?: "sse" | "websocket" | "auto";
    requestPolicy?: "openai" | "compat";
    capabilities?: Record<string, boolean>;
    defaultParams?: Record<string, unknown>;
    allowedParams?: Record<string, unknown>;
    sortOrder?: number;
}
