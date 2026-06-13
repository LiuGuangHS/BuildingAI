import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import type { PromptOptimizationStyle } from "../../modules/generation/dto/prompt-optimization.dto";

export enum VideoPromptOptimizationBillingStatus {
    FREE = "free",
    DEDUCTED = "deducted",
    FAILED = "failed",
}

@ExtensionEntity()
@Index("idx_video_prompt_opt_user", ["userId"])
@Index("uq_video_prompt_opt_user_request_key", ["userId", "requestKey"], {
    unique: true,
    where: `"request_key" IS NOT NULL`,
})
export class VideoPromptOptimization {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", comment: "Creator user ID" })
    userId: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Idempotency key from client" })
    requestKey?: string;

    @Column({ type: "text", comment: "Original prompt" })
    originalPrompt: string;

    @Column({ type: "text", comment: "Optimized prompt" })
    optimizedPrompt: string;

    @Column({ type: "varchar", length: 20, comment: "Optimization source" })
    source: "ai" | "local";

    @Column({ type: "varchar", length: 30, comment: "Optimization style" })
    style: PromptOptimizationStyle;

    @Column({ type: "uuid", nullable: true, comment: "Main-system AI model id" })
    modelId?: string;

    @Column({ type: "jsonb", nullable: true, comment: "Token usage snapshot" })
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };

    @Column({ type: "float", default: 0, comment: "Consumed power" })
    consumedPower: number;

    @Column({
        type: "varchar",
        length: 30,
        default: VideoPromptOptimizationBillingStatus.FREE,
        comment: "Billing status",
    })
    billingStatus: VideoPromptOptimizationBillingStatus;

    @Column({ type: "text", nullable: true, comment: "Fallback warning" })
    warning?: string;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
