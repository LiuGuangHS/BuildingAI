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

@ExtensionEntity()
export class VideoModelConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", comment: "Main-system text-to-video model ID" })
    mainModelId: string;

    @Column({ type: "varchar", length: 120, nullable: true, comment: "Display name override" })
    displayNameOverride?: string | null;

    @Column({ type: "text", nullable: true, comment: "Description override" })
    descriptionOverride?: string | null;

    @Column({ type: "boolean", default: true, comment: "Whether model is enabled" })
    enabled: boolean;

    @Column({ type: "boolean", default: true, comment: "Whether visible to web users" })
    visibleToUser: boolean;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Video model capabilities" })
    capabilities: VideoModelCapabilities;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Default generation params" })
    defaultParams: VideoModelDefaultParams;

    @Column({ type: "int", default: 0, comment: "Sort order" })
    sortOrder: number;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
