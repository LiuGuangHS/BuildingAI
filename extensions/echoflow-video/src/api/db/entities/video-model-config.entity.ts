import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export type VideoAbilityType =
    | "text_to_video"
    | "first_frame_i2v"
    | "reference_to_video"
    | "video_editing"
    | "action_transfer"
    | "digital_human"
    | "native_audio";

export type VideoMediaType = "first_frame" | "reference_image" | "video" | "audio";

export interface VideoDurationCapability {
    min?: number;
    max?: number;
    allowedValues?: number[];
}

export interface VideoModelCapabilities {
    abilityTypes?: VideoAbilityType[];
    mediaTypes?: VideoMediaType[];
    duration?: VideoDurationCapability;
    resolutions?: string[];
    ratios?: string[];
    fps?: number;
    format?: string;
    apiContractVerified?: boolean;
}

export interface VideoModelDefaultParams {
    duration?: number;
    resolution?: string;
    ratio?: string;
    watermark?: boolean;
}

export interface VideoModelEndpoint {
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    apiKeyMasked?: string;
    enabled: boolean;
    priority: number;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

@ExtensionEntity()
export class VideoModelConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, default: "happyhorse", comment: "Provider identifier" })
    provider: string;

    @Column({ type: "varchar", length: 100, unique: true, comment: "Provider model identifier" })
    model: string;

    @Column({ type: "varchar", length: 120, comment: "Display name" })
    displayName: string;

    @Column({ type: "text", nullable: true, comment: "Description" })
    description?: string;

    @Column({ type: "boolean", default: true, comment: "Whether model is enabled" })
    enabled: boolean;

    @Column({ type: "boolean", default: true, comment: "Whether visible to web users" })
    visibleToUser: boolean;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Video model capabilities" })
    capabilities: VideoModelCapabilities;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Default generation params" })
    defaultParams: VideoModelDefaultParams;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Model-level API endpoints" })
    endpoints: VideoModelEndpoint[];

    @Column({ type: "int", default: 0, comment: "Sort order" })
    sortOrder: number;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
