import { BaseProviderSettings, generateTextWithUsage } from "@buildingai/ai-sdk";
import { SecretService } from "@buildingai/core/modules";
import { AiModel, Secret } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";
type GenerateTextWithUsageParams = Parameters<typeof generateTextWithUsage>[0];
export type PublicAiGenerateTextParams = GenerateTextWithUsageParams extends infer T ? T extends unknown ? Omit<T, "model"> : never : never;
export type PublicAiGenerateTextResult = Awaited<ReturnType<typeof generateTextWithUsage>>;
/**
 * Public AI Model Service
 */
export declare class PublicAiModelService {
    protected readonly aiModelRepository: Repository<AiModel>;
    protected readonly secretRepository: Repository<Secret>;
    private readonly secretService;
    protected readonly logger: Logger;
    private readonly baseService;
    constructor(aiModelRepository: Repository<AiModel>, secretRepository: Repository<Secret>, secretService: SecretService);
    getModelInfo(modelId: string): Promise<AiModel>;
    listActiveLlmModels(take?: number): Promise<AiModel[]>;
    /**
     * Get provider config
     * @param modelId AI model identifier
     * @returns Provider config
     */
    getProviderConfig(modelId: string): Promise<Record<string, {
        value: string;
        required: boolean;
    }>>;
    /**
     * Get provider
     * @param modelId AI model identifier
     * @param configKeys Config keys
     * @returns Provider
     */
    getProviderAdapter(modelId: string, config?: BaseProviderSettings): Promise<import("@buildingai/ai-sdk").CallableProvider>;
    generateText(modelId: string, params: PublicAiGenerateTextParams): Promise<PublicAiGenerateTextResult>;
}
export {};
//# sourceMappingURL=ai-model.service.d.ts.map