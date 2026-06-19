import { ExtensionEntity } from "@buildingai/core/decorators";
import { User } from "@buildingai/db/entities";
import {
    Column,
    CreateDateColumn,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export enum VideoGenerationStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    SUCCEEDED = "succeeded",
    FAILED = "failed",
}

export enum VideoGenerationBillingStatus {
    PENDING = "pending",
    DEDUCTED = "deducted",
    REFUNDED = "refunded",
    FAILED = "failed",
}

/** Built-in HappyHorse models kept as constants for the EchoFlow video catalog. */
export enum HappyHorseModel {
    I2V = "happyhorse-1.0-i2v",
    R2V = "happyhorse-1.0-r2v",
    T2V = "happyhorse-1.0-t2v",
    VIDEO_EDIT = "happyhorse-1.0-video-edit",
}

export interface VideoMediaItem {
    type: "first_frame" | "reference_image" | "video";
    url: string;
    fileId?: string;
    mimeType?: string;
    fileName?: string;
    size?: number;
}

export interface VideoParameters {
    resolution?: string;       // e.g. "720P"
    duration?: number;         // seconds
    ratio?: string;            // e.g. "16:9"
    watermark?: boolean;
    audio_setting?: string;    // video-edit only
}

export interface VideoGenerationStatusEvent {
    status: VideoGenerationStatus;
    at: string;
    message?: string;
    source?: "web" | "console" | "provider" | "webhook" | "system";
}

@ExtensionEntity()
@Index("idx_video_gen_user", ["userId"])
@Index("uq_video_generation_user_request_key", ["userId", "requestKey"], {
    unique: true,
    where: `"request_key" IS NOT NULL`,
})
export class VideoGeneration {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", comment: "Creator user ID" })
    userId: string;

    @Column({ type: "varchar", length: 100, comment: "Video model identifier" })
    model: string;

    @Column({ type: "uuid", nullable: true, comment: "Video model config ID" })
    modelConfigId?: string;

    @Column({ type: "varchar", length: 50, nullable: true, comment: "Provider identifier" })
    provider?: string;

    @Column({ type: "varchar", length: 120, nullable: true, comment: "Model display name snapshot" })
    modelName?: string;

    @Column({ type: "varchar", length: 30, default: VideoGenerationStatus.PENDING })
    status: VideoGenerationStatus;

    @Column({ type: "varchar", length: 30, default: VideoGenerationBillingStatus.PENDING })
    billingStatus: VideoGenerationBillingStatus;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Idempotency key from client" })
    requestKey?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Provider task ID" })
    taskId?: string;

    @Column({ type: "text", comment: "Video generation prompt" })
    prompt: string;

    @Column({ type: "text", nullable: true, comment: "Original prompt before optimization" })
    originalPrompt?: string;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Prompt optimization source" })
    promptOptimizationSource?: "ai" | "local";

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Prompt optimization style" })
    promptOptimizationStyle?: string;

    @Column({ type: "uuid", nullable: true, comment: "Main-system AI model id used for prompt optimization" })
    promptOptimizerModelId?: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Input media array" })
    media: VideoMediaItem[];

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Generation parameters" })
    parameters: VideoParameters;

    @Column({ type: "text", nullable: true, comment: "Result video URL" })
    videoUrl?: string;

    @Column({ type: "text", nullable: true, comment: "Error message" })
    errorMessage?: string;

    @Column({ type: "varchar", length: 50, nullable: true, comment: "Normalized failure category" })
    failureCategory?: string;

    @Column({ type: "text", nullable: true, comment: "Admin note" })
    adminRemark?: string;

    @Column({ type: "jsonb", nullable: true, comment: "Raw request sent to provider" })
    rawRequest?: Record<string, unknown>;

    @Column({ type: "jsonb", nullable: true, comment: "Raw response from provider" })
    rawResponse?: Record<string, unknown>;

    @Column({ type: "jsonb", nullable: true, comment: "Billing rule snapshot" })
    billingRuleSnapshot?: Record<string, unknown>;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Status transition events" })
    statusEvents: VideoGenerationStatusEvent[];

    @Column({ type: "int", default: 0, comment: "Progress percent" })
    progress: number;

    @Column({ type: "float", default: 0, comment: "Deducted billing amount" })
    billingAmount: number;

    @Column({ type: "timestamp", nullable: true, comment: "Started time" })
    startedAt?: Date;

    @Column({ type: "timestamp", nullable: true, comment: "Completed time" })
    completedAt?: Date;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: "user_id" })
    user: User;
}
