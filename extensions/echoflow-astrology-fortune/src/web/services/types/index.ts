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
    userId: string;
    zodiacSign: string;
    chineseZodiac: string;
    personalitySnapshot: Record<string, unknown>;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type AstrologyReportResult = {
    title: string;
    summary: string;
    scores?: Record<string, number>;
    keywords?: string[];
    lucky?: { color?: string; number?: number; direction?: string; timeRange?: string };
    sections?: Array<{ heading: string; content: string }>;
    actions?: string[];
    warnings?: string[];
    closing?: string;
};

export type AstrologyReport = {
    id: string;
    userId: string;
    profileId?: string | null;
    modelId: string;
    providerId: string;
    reportType: AstrologyReportType;
    question?: string | null;
    status: AstrologyReportStatus;
    result?: AstrologyReportResult | null;
    resultText?: string | null;
    score?: number | null;
    tags: string[];
    isFavorite: boolean;
    errorMessage?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AstrologyFortuneSetting = {
    id: string;
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
};

export type QueryAstrologyReportsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    reportType?: AstrologyReportType;
    status?: AstrologyReportStatus;
    profileId?: string;
    isFavorite?: boolean;
    userId?: string;
    modelId?: string;
    providerId?: string;
};

export type QueryAstrologyProfilesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    userId?: string;
};

export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
