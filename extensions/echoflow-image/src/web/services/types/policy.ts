export interface ImagePolicyConfig {
    id: string;
    scope: "global" | "model";
    modelConfigId?: string;
    maxPromptLength: number;
    maxNegativePromptLength: number;
    maxImagesPerRequest: number;
    maxReferenceImages: number;
    maxReferenceImageSizeMb: number;
    maxConcurrentJobsPerUser: number;
    dailyJobsPerUser: number;
    allowPublicUrlReference: boolean;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export type SavePolicyParams = Partial<Omit<ImagePolicyConfig, "id" | "createdAt" | "updatedAt">>;
