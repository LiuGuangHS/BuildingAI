export const VideoGenerationStatus = {
    PENDING: "pending",
    PROCESSING: "processing",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
} as const;

export type VideoGenerationStatus =
    (typeof VideoGenerationStatus)[keyof typeof VideoGenerationStatus];

export const VideoGenerationBillingStatus = {
    PENDING: "pending",
    DEDUCTED: "deducted",
    REFUNDED: "refunded",
    FAILED: "failed",
} as const;

export type VideoGenerationBillingStatus =
    (typeof VideoGenerationBillingStatus)[keyof typeof VideoGenerationBillingStatus];

export const HappyHorseModel = {
    I2V: "happyhorse-1.0-i2v",
    R2V: "happyhorse-1.0-r2v",
    T2V: "happyhorse-1.0-t2v",
    VIDEO_EDIT: "happyhorse-1.0-video-edit",
} as const;

export type HappyHorseModel = (typeof HappyHorseModel)[keyof typeof HappyHorseModel];

export interface VideoMediaItem {
    type: "first_frame" | "reference_image" | "video";
    url: string;
    fileId?: string;
    mimeType?: string;
    fileName?: string;
    size?: number;
}

export interface VideoParameters {
    resolution?: string;
    duration?: number;
    ratio?: string;
    watermark?: boolean;
    audio_setting?: string;
}

export interface VideoGeneration {
    id: string;
    userId: string;
    model: string;
    modelConfigId?: string;
    provider?: string;
    modelName?: string;
    status: VideoGenerationStatus;
    billingStatus: VideoGenerationBillingStatus;
    requestKey?: string;
    taskId?: string;
    prompt: string;
    originalPrompt?: string;
    promptOptimizationSource?: "ai" | "local";
    promptOptimizationStyle?: string;
    promptOptimizerModelId?: string;
    media: VideoMediaItem[];
    parameters: VideoParameters;
    videoUrl?: string;
    errorMessage?: string;
    failureCategory?: string;
    adminRemark?: string;
    rawRequest?: Record<string, unknown>;
    rawResponse?: Record<string, unknown>;
    billingRuleSnapshot?: Record<string, unknown>;
    statusEvents?: Array<{
        status: VideoGenerationStatus;
        at: string;
        message?: string;
        source?: "web" | "console" | "provider" | "webhook" | "system";
    }>;
    progress: number;
    billingAmount: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OperationResult {
    success: boolean;
    message: string;
}

export interface VideoDurationCapability {
    min?: number;
    max?: number;
    allowedValues?: number[];
}

export interface VideoModelCapabilities {
    abilityTypes?: string[];
    mediaTypes?: Array<VideoMediaItem["type"] | "audio">;
    duration?: VideoDurationCapability;
    resolutions?: string[];
    ratios?: string[];
    fps?: number;
    format?: string;
    apiContractVerified?: boolean;
}

export interface VideoModelDefaultParams {
    duration?: number;
    resolution?: string;
    ratio?: string;
    watermark?: boolean;
}

export interface VideoModelEndpoint {
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    apiKeyMasked?: string;
    enabled: boolean;
    priority: number;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

export interface VideoModelOption {
    id: string;
    modelConfigId?: string;
    name: string;
    model: string;
    provider?: string;
    modelType: string;
    description: string;
    mediaTypes: string[];
    capabilities?: VideoModelCapabilities;
    defaultParams?: VideoModelDefaultParams;
}

export interface VideoModelConfig {
    id: string;
    provider: string;
    model: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    visibleToUser: boolean;
    capabilities: VideoModelCapabilities;
    defaultParams: VideoModelDefaultParams;
    endpoints?: VideoModelEndpoint[];
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface SaveVideoModelConfigParams {
    provider?: string;
    model?: string;
    displayName?: string;
    description?: string;
    enabled?: boolean;
    visibleToUser?: boolean;
    capabilities?: VideoModelCapabilities;
    defaultParams?: VideoModelDefaultParams;
    endpoints?: VideoModelEndpoint[];
    sortOrder?: number;
}

export interface QueryVideoParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: VideoGenerationStatus;
    model?: string;
    billingStatus?: VideoGenerationBillingStatus;
    failureCategory?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: "createdAt" | "updatedAt" | "completedAt" | "billingAmount";
    sortOrder?: "ASC" | "DESC" | "asc" | "desc";
}

export interface CreateVideoParams {
    prompt: string;
    originalPrompt?: string;
    promptOptimizationSource?: "ai" | "local";
    promptOptimizationStyle?: string;
    promptOptimizerModelId?: string;
    model: string;
    requestKey?: string;
    media?: VideoMediaItem[];
    resolution?: string;
    duration?: number;
    ratio?: string;
    watermark?: boolean;
    audioSetting?: string;
}

export type PromptOptimizationStyle = "cinematic" | "commercial" | "realistic" | "anime" | "minimal";

export interface OptimizePromptParams {
    prompt: string;
    model?: string;
    style?: PromptOptimizationStyle;
    modelId?: string;
    requestKey?: string;
    ratio?: string;
    resolution?: string;
}

export interface PromptOptimizationResult {
    originalPrompt: string;
    optimizedPrompt: string;
    source: "ai" | "local";
    style: PromptOptimizationStyle;
    modelId?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    consumedPower?: number;
    warning?: string;
}

export interface PromptOptimizerModelOption {
    id: string;
    name: string;
    model: string;
    provider?: string;
    isDefault?: boolean;
    billingRule?: {
        power?: number;
        tokens?: number;
    };
}

export interface PromptOptimizerOptions {
    enabled: boolean;
    defaultModelId?: string;
    billingEnabled: boolean;
    models: PromptOptimizerModelOption[];
}

export interface BillingEstimate {
    amount: number;
}

export interface EstimateVideoBillingParams {
    modelConfigId?: string;
    model?: string;
    duration?: number;
    resolution?: string;
}

export interface VideoBillingRule {
    id: string;
    modelConfigId?: string;
    baseCost: number;
    perSecondCost: number;
    resolutionMultipliers: Record<string, number>;
    minimumCost: number;
    refundOnFailure: boolean;
    enabled: boolean;
    modelConfig?: VideoModelConfig;
    createdAt: string;
    updatedAt: string;
}

export interface SaveVideoBillingRuleParams {
    modelConfigId?: string;
    baseCost?: number;
    perSecondCost?: number;
    resolutionMultipliers?: Record<string, number>;
    minimumCost?: number;
    refundOnFailure?: boolean;
    enabled?: boolean;
}

export interface VideoPromptTemplate {
    id: string;
    title: string;
    category: string;
    prompt: string;
    abilityTypes: string[];
    modelConfigId?: string;
    defaultParams: VideoModelDefaultParams;
    coverImageUrl?: string;
    enabled: boolean;
    sortOrder: number;
    modelConfig?: VideoModelConfig;
    createdAt: string;
    updatedAt: string;
}

export interface SaveVideoTemplateParams {
    title?: string;
    category?: string;
    prompt?: string;
    abilityTypes?: string[];
    modelConfigId?: string;
    defaultParams?: VideoModelDefaultParams;
    coverImageUrl?: string;
    enabled?: boolean;
    sortOrder?: number;
}

export const VideoPolicyScope = {
    GLOBAL: "global",
    MODEL: "model",
} as const;

export type VideoPolicyScope = (typeof VideoPolicyScope)[keyof typeof VideoPolicyScope];

export interface VideoPolicyConfig {
    id: string;
    scope: VideoPolicyScope;
    modelConfigId?: string;
    maxPromptLength: number;
    maxMediaItemsPerRequest: number;
    maxReferenceImages: number;
    maxVideoSizeMb: number;
    maxImageSizeMb: number;
    maxConcurrentJobsPerUser: number;
    dailyJobsPerUser: number;
    allowPublicMediaUrl: boolean;
    enabled: boolean;
    modelConfig?: VideoModelConfig;
    createdAt: string;
    updatedAt: string;
}

export interface SaveVideoPolicyParams {
    scope?: VideoPolicyScope;
    modelConfigId?: string;
    maxPromptLength?: number;
    maxMediaItemsPerRequest?: number;
    maxReferenceImages?: number;
    maxVideoSizeMb?: number;
    maxImageSizeMb?: number;
    maxConcurrentJobsPerUser?: number;
    dailyJobsPerUser?: number;
    allowPublicMediaUrl?: boolean;
    enabled?: boolean;
}
