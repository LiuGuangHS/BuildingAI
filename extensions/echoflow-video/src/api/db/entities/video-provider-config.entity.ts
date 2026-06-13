import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export interface PromptTemplate {
    label: string;
    prompt: string;
}

@ExtensionEntity()
export class VideoProviderConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, unique: true, default: "happyhorse" })
    provider: string;

    @Column({ type: "text", comment: "Provider API key" })
    apiKey: string;

    @Column({ type: "varchar", length: 500, default: "https://api.echoflow.cn", comment: "Provider base URL" })
    baseUrl: string;

    @Column({ type: "integer", default: 120000, comment: "Submit and poll request timeout in milliseconds" })
    requestTimeoutMs: number;

    @Column({ type: "integer", default: 15000, comment: "Connectivity test timeout in milliseconds" })
    testTimeoutMs: number;

    @Column({ type: "integer", default: 2, comment: "Maximum retry count for retryable provider requests" })
    maxRetries: number;

    @Column({ type: "integer", default: 1000, comment: "Base retry delay in milliseconds" })
    retryDelayMs: number;

    @Column({ type: "text", nullable: true, comment: "Encrypted webhook secret for provider callbacks" })
    webhookSecret?: string;

    @Column({ type: "boolean", default: true, comment: "Whether prompt optimizer is enabled" })
    promptOptimizerEnabled: boolean;

    @Column({ type: "uuid", nullable: true, comment: "Main-system AI model id for prompt optimization" })
    promptOptimizerModelId?: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Allowed main-system AI model ids for prompt optimization" })
    promptOptimizerAllowedModelIds: string[];

    @Column({ type: "boolean", default: true, comment: "Whether prompt optimizer charges by chat token usage" })
    promptOptimizerBillingEnabled: boolean;

    @Column({ type: "integer", default: 1, comment: "Power cost per token bucket for prompt optimization" })
    promptOptimizerBillingPower: number;

    @Column({ type: "integer", default: 1000, comment: "Token bucket size for prompt optimization billing" })
    promptOptimizerBillingTokens: number;

    @Column({ type: "integer", default: 500, comment: "Estimated token usage for prompt optimizer pre-check" })
    promptOptimizerEstimatedTokens: number;

    @Column({ type: "boolean", default: true, comment: "Whether provider config is enabled" })
    enabled: boolean;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Prompt templates for quick fill" })
    templates: PromptTemplate[];

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
