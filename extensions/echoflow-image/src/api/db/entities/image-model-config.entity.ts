import { ExtensionEntity } from "@buildingai/core/decorators";
import { AiModel } from "@buildingai/db/entities";
import {
    Column,
    CreateDateColumn,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export enum ImageApiMode {
    IMAGES = "images",
    RESPONSES = "responses",
}

export enum ImageResponsesTransport {
    SSE = "sse",
    WEBSOCKET = "websocket",
    AUTO = "auto",
}

export enum ImageRequestPolicy {
    OPENAI = "openai",
    COMPAT = "compat",
}

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

    @Column({ type: "uuid", comment: "Base AI model ID" })
    aiModelId: string;

    @Column({ type: "varchar", length: 120, comment: "Display name" })
    displayName: string;

    @Column({ type: "text", nullable: true, comment: "Description" })
    description?: string;

    @Column({ type: "boolean", default: true, comment: "Whether enabled for web users" })
    enabled: boolean;

    @Column({ type: "varchar", length: 30, default: ImageApiMode.IMAGES })
    apiMode: ImageApiMode;

    @Column({ type: "varchar", length: 30, default: ImageResponsesTransport.SSE })
    responsesTransport: ImageResponsesTransport;

    @Column({ type: "varchar", length: 30, default: ImageRequestPolicy.OPENAI })
    requestPolicy: ImageRequestPolicy;

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

    @ManyToOne(() => AiModel, { nullable: false })
    @JoinColumn({ name: "ai_model_id" })
    aiModel: AiModel;
}
