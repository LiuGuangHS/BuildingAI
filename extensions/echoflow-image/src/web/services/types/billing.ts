export interface ImageBillingRule {
    id: string;
    modelConfigId?: string;
    baseCost: number;
    textToImageMultiplier: number;
    imageToImageMultiplier: number;
    qualityMultipliers: Record<string, number>;
    sizeMultipliers: Record<string, number>;
    countMultiplierEnabled: boolean;
    refundOnFailure: boolean;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SaveBillingRuleParams {
    modelConfigId?: string;
    baseCost?: number;
    textToImageMultiplier?: number;
    imageToImageMultiplier?: number;
    qualityMultipliers?: Record<string, number>;
    sizeMultipliers?: Record<string, number>;
    countMultiplierEnabled?: boolean;
    refundOnFailure?: boolean;
    enabled?: boolean;
}

export interface EstimateBillingParams {
    modelConfigId?: string;
    mode?: string;
    size?: string;
    n?: number;
    quality?: string;
}

export interface BillingEstimate {
    amount: number;
}
