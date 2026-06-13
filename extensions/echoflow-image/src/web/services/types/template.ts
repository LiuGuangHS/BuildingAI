export interface ImagePromptTemplate {
    id: string;
    title: string;
    category: string;
    prompt: string;
    negativePrompt?: string;
    defaultParams: Record<string, unknown>;
    coverImageUrl?: string;
    enabled: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface SaveTemplateParams {
    title?: string;
    category?: string;
    prompt?: string;
    negativePrompt?: string;
    defaultParams?: Record<string, unknown>;
    coverImageUrl?: string;
    enabled?: boolean;
    sortOrder?: number;
}
