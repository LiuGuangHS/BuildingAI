import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import { ImageModelConfig } from "./image-model-config.entity";

export enum ImagePolicyScope {
    GLOBAL = "global",
    MODEL = "model",
}

@ExtensionEntity()
export class ImagePolicyConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 30, default: ImagePolicyScope.GLOBAL })
    scope: ImagePolicyScope;

    @Column({ type: "uuid", nullable: true })
    modelConfigId?: string;

    @Column({ type: "int", default: 4000 })
    maxPromptLength: number;

    @Column({ type: "int", default: 2000 })
    maxNegativePromptLength: number;

    @Column({ type: "int", default: 4 })
    maxImagesPerRequest: number;

    @Column({ type: "int", default: 1 })
    maxReferenceImages: number;

    @Column({ type: "int", default: 10 })
    maxReferenceImageSizeMb: number;

    @Column({ type: "int", default: 1 })
    maxConcurrentJobsPerUser: number;

    @Column({ type: "int", default: 100 })
    dailyJobsPerUser: number;

    @Column({ type: "boolean", default: false })
    allowPublicUrlReference: boolean;

    @Column({ type: "boolean", default: true })
    enabled: boolean;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

    @ManyToOne(() => ImageModelConfig, { nullable: true })
    @JoinColumn({ name: "model_config_id" })
    modelConfig?: ImageModelConfig;
}
