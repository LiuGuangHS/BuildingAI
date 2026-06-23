export type AstrologyReportType = "profile" | "daily" | "weekly" | "monthly" | "personality" | "love" | "career" | "wealth" | "relationship" | "compatibility" | "decision";

export type AstrologyReportStatus = "pending" | "processing" | "success" | "failed";

export type AstrologyProfileInput = {
    name: string;
    gender?: string;
    birthDate: string;
    birthTime?: string;
    birthPlace?: string;
    zodiacSign?: string;
    moonSign?: string;
    risingSign?: string;
};

export type AstrologyProfile = AstrologyProfileInput & {
    id: string;
    zodiacSign: string;
    chineseZodiac: string;
    personalitySnapshot: Record<string, unknown>;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type ConsoleAstrologyProfile = AstrologyProfile & {
    userId: string;
};

export type AstrologyGenerationStatus = {
    canGenerate: boolean;
    unavailableReason?: string | null;
    prices: {
        daily: number;
        report: number;
        compatibility: number;
        decision: number;
    };
};

export type AstrologyReportResult = {
    title: string;
    summary: string;
    scores?: Record<string, number>;
    keywords?: string[];
    lucky?: { color?: string; number?: number; direction?: string; timeRange?: string };
    evidence?: Array<{ source: string; insight: string; confidence?: "low" | "medium" | "high" }>;
    sections?: Array<{ heading: string; content: string }>;
    actions?: Array<string | { item: string; reason?: string; timebox?: string }>;
    warnings?: Array<string | { title: string; detail?: string }>;
    reviewChecklist?: Array<{
        item: string;
        why: string;
        evidenceSource: string;
        timebox?: string;
    }>;
    followUps?: string[];
    closing?: string;
};

export type AstrologyReport = {
    id: string;
    profileId?: string | null;
    reportType: AstrologyReportType;
    question?: string | null;
    status: AstrologyReportStatus;
    result?: AstrologyReportResult | null;
    resultText?: string | null;
    score?: number | null;
    tags: string[];
    isFavorite: boolean;
    costCredits: number | string;
    errorMessage?: string | null;
    providerMetadata?: (Record<string, unknown> & {
        feedback?: {
            rating: "useful" | "too_generic" | "inaccurate" | "too_long";
            note?: string;
            updatedAt?: string;
        };
        sourceReport?: {
            id?: string;
            reportType?: AstrologyReportType;
            title?: string | null;
        };
        generationContext?: {
            reportType?: AstrologyReportType;
            focusArea?: string;
            currentState?: string;
            question?: string;
            language?: string;
            sourceReportId?: string;
            hasTargetProfile?: boolean;
            questionQuality?: {
                level?: "weak" | "usable" | "strong";
                score?: number;
                signals?: string[];
                missing?: string[];
            };
        };
    }) | null;
    createdAt: string;
    updatedAt: string;
};

export type ConsoleAstrologyReport = AstrologyReport & {
    userId: string;
    modelId?: string;
    providerId?: string;
    requestPayload?: Record<string, unknown> | null;
};

export type UpdateReportFeedbackParams = {
    rating: "useful" | "too_generic" | "inaccurate" | "too_long";
    note?: string;
};

export type AstrologyReportStats = {
    total: number;
    success: number;
    failed: number;
    pending: number;
    processing: number;
    busy: number;
    favorite: number;
};

export type AstrologyFortuneSetting = {
    id: string;
    key: string;
    defaultModelId?: string | null;
    dailyPrice: number;
    reportPrice: number;
    compatibilityPrice: number;
    decisionPrice: number;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type UpdateAstrologyFortuneSettingParams = {
    defaultModelId?: string;
    dailyPrice?: number;
    reportPrice?: number;
    compatibilityPrice?: number;
    decisionPrice?: number;
};

export type AiModelOption = {
    id: string;
    name?: string;
    model?: string;
    modelType?: string;
    isActive?: boolean;
    provider?: {
        id: string;
        name?: string;
        provider?: string;
        isActive?: boolean;
    };
};

export type GenerateAstrologyReportParams = {
    reportType: AstrologyReportType;
    profileId?: string;
    profile?: Partial<AstrologyProfileInput>;
    question?: string;
    targetProfile?: Record<string, unknown>;
    focusArea?: string;
    currentState?: string;
    language?: string;
    sourceReportId?: string;
};

export type QueryAstrologyReportsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    reportType?: AstrologyReportType;
    status?: AstrologyReportStatus;
    profileId?: string;
    isFavorite?: boolean;
};

export type ConsoleQueryAstrologyReportsParams = QueryAstrologyReportsParams & {
    userId?: string;
    modelId?: string;
    providerId?: string;
};

export type QueryAstrologyProfilesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
};

export type ConsoleQueryAstrologyProfilesParams = QueryAstrologyProfilesParams & {
    userId?: string;
};

export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
