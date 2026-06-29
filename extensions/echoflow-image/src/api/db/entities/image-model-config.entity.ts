import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export interface ImageModelCapabilities {
    textToImage?: boolean;
    imageToImage?: boolean;
    mask?: boolean;
    multiReference?: boolean;
    seed?: boolean;
    negativePrompt?: boolean;
    outputFormat?: boolean;
    background?: boolean;
    moderation?: boolean;
    inputFidelity?: boolean;
}

export interface ImageModelDefaultParams {
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    responseFormat?: string;
    outputFormat?: string;
}

export interface ImageModelAllowedParams {
    sizes?: string[];
    qualities?: string[];
    styles?: string[];
    outputFormats?: string[];
    maxImages?: number;
}

@ExtensionEntity()
export class ImageModelConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", comment: "Main-system text-to-image model ID" })
    mainModelId: string;

    @Column({ type: "uuid", nullable: true, comment: "Main-system LLM model ID for prompt enhancement" })
    promptEnhancerModelId?: string | null;

    @Column({ type: "varchar", length: 120, nullable: true, comment: "Display name override" })
    displayNameOverride?: string | null;

    @Column({ type: "text", nullable: true, comment: "Description override" })
    descriptionOverride?: string | null;

    @Column({ type: "boolean", default: true, comment: "Whether enabled for web users" })
    enabled: boolean;

    @Column({ type: "boolean", default: true, comment: "Whether visible to web users" })
    visibleToUser: boolean;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Supported image features" })
    capabilities: ImageModelCapabilities;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Default generation params" })
    defaultParams: ImageModelDefaultParams;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Allowed generation params" })
    allowedParams: ImageModelAllowedParams;

    @Column({ type: "int", default: 0, comment: "Sort order" })
    sortOrder: number;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

}
