export interface ImageModelConfig {
    id: string;
    mainModelId: string;
    promptEnhancerModelId?: string | null;
    provider: string;
    providerName: string;
    model: string;
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
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface SaveModelConfigParams {
    mainModelId?: string;
    displayName?: string;
    description?: string;
    promptEnhancerModelId?: string | null;
    enabled?: boolean;
    visibleToUser?: boolean;
    defaultParams?: Record<string, unknown>;
    allowedParams?: Record<string, unknown>;
    sortOrder?: number;
}

export interface PromptEnhancerModelOption {
    id: string;
    name: string;
    model: string;
    modelType: string;
    providerName: string;
    provider: string;
}
