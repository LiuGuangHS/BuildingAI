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
    outputFormats?: string[];
    maxImages?: number;
}

export type ImageRequestContract = "responses" | "images" | "openai-compatible-images" | "provider-native";

export interface ImageModelEndpoint {
    id?: string;
    name: string;
    secretId?: string;
    secretName?: string;
    baseUrlOverride?: string;
    enabled: boolean;
    priority: number;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

@ExtensionEntity()
export class ImageModelConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, default: "echoflow-api", comment: "Provider identifier" })
    provider: string;

    @Column({ type: "varchar", length: 100, unique: true, comment: "Product model identifier" })
    model: string;

    @Column({ type: "varchar", length: 100, comment: "Upstream model identifier" })
    externalModelId: string;

    @Column({ type: "varchar", length: 50, default: "responses", comment: "Request contract" })
    requestContract: ImageRequestContract;

    @Column({ type: "varchar", length: 120, comment: "Display name" })
    displayName: string;

    @Column({ type: "text", nullable: true, comment: "Description" })
    description?: string;

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

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Model-level API endpoints" })
    endpoints: ImageModelEndpoint[];

    @Column({ type: "int", default: 0, comment: "Sort order" })
    sortOrder: number;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

}
