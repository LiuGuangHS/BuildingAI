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

export enum ImageGenerationStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    SUCCEEDED = "succeeded",
    FAILED = "failed",
}

export enum ImageGenerationBillingStatus {
    PENDING = "pending",
    DEDUCTED = "deducted",
    REFUNDED = "refunded",
    FAILED = "failed",
}

export enum ImageGenerationMode {
    TEXT_TO_IMAGE = "text-to-image",
    IMAGE_TO_IMAGE = "image-to-image",
}

export enum ImageResponseFormat {
    B64_JSON = "b64_json",
    URL = "url",
}

export interface GeneratedImageRecord {
    url?: string;
    b64Json?: string;
    mimeType?: string;
    revisedPrompt?: string;
}

export interface ImageSourceRecord {
    url?: string;
    fileId?: string;
    mimeType?: string;
}

@ExtensionEntity()
@Index("uq_image_generation_user_request_key", ["userId", "requestKey"], {
    unique: true,
    where: `"request_key" IS NOT NULL`,
})
export class ImageGeneration {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", comment: "Creator user ID" })
    userId: string;

    @Column({ type: "varchar", length: 30, default: ImageGenerationMode.TEXT_TO_IMAGE })
    mode: ImageGenerationMode;

    @Column({ type: "varchar", length: 30, default: ImageGenerationStatus.PENDING })
    status: ImageGenerationStatus;

    @Column({ type: "varchar", length: 30, default: ImageGenerationBillingStatus.PENDING })
    billingStatus: ImageGenerationBillingStatus;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Idempotency key from client" })
    requestKey?: string;

    @Column({ type: "uuid", nullable: true, comment: "Image model config ID" })
    modelConfigId?: string;

    @Column({ type: "text", comment: "Prompt" })
    prompt: string;

    @Column({ type: "text", nullable: true, comment: "Negative prompt" })
    negativePrompt?: string;

    @Column({ type: "text", nullable: true, comment: "Reference image URL" })
    referenceImageUrl?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Reference image file ID" })
    referenceImageFileId?: string;

    @Column({ type: "varchar", length: 100, comment: "AI model ID" })
    modelId: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "AI model name" })
    modelName?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "AI provider" })
    provider?: string;

    @Column({ type: "varchar", length: 500, nullable: true, comment: "OpenAI-compatible base URL" })
    baseURL?: string;

    @Column({ type: "varchar", length: 30, default: "1024x1024", comment: "Image size" })
    size: string;

    @Column({ type: "int", default: 1, comment: "Image count" })
    n: number;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Image quality" })
    quality?: string;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Image style" })
    style?: string;

    @Column({ type: "varchar", length: 30, default: ImageResponseFormat.B64_JSON })
    responseFormat: ImageResponseFormat;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "API mode" })
    apiMode?: string;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Request policy" })
    requestPolicy?: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Source images" })
    sourceImages: ImageSourceRecord[];

    @Column({ type: "jsonb", nullable: true, comment: "Mask image" })
    maskImage?: ImageSourceRecord;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Output format" })
    outputFormat?: string;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Background" })
    background?: string;

    @Column({ type: "int", nullable: true, comment: "Output compression" })
    outputCompression?: number;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Input fidelity" })
    inputFidelity?: string;

    @Column({ type: "varchar", length: 30, nullable: true, comment: "Moderation" })
    moderation?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Seed" })
    seed?: string;

    @Column({ type: "int", nullable: true, comment: "Steps" })
    steps?: number;

    @Column({ type: "float", nullable: true, comment: "CFG scale" })
    cfgScale?: number;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Generated image records" })
    resultImages: GeneratedImageRecord[];

    @Column({ type: "jsonb", nullable: true, comment: "Raw request summary" })
    rawRequest?: Record<string, unknown>;

    @Column({ type: "jsonb", nullable: true, comment: "Raw response summary" })
    rawResponse?: Record<string, unknown>;

    @Column({ type: "text", nullable: true, comment: "Error message" })
    errorMessage?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Failure code" })
    failureCode?: string;

    @Column({ type: "varchar", length: 100, nullable: true, comment: "Failure category" })
    failureCategory?: string;

    @Column({ type: "int", default: 0, comment: "Progress percent" })
    progress: number;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Stored output files" })
    storageFiles: ImageSourceRecord[];

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Raw event summaries" })
    rawEvents: Array<Record<string, unknown>>;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0, comment: "Billing amount" })
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
