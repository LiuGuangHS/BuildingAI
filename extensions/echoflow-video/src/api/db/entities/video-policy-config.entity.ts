import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import { VideoModelConfig } from "./video-model-config.entity";

export enum VideoPolicyScope {
    GLOBAL = "global",
    MODEL = "model",
}

@ExtensionEntity()
export class VideoPolicyConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 30, default: VideoPolicyScope.GLOBAL })
    scope: VideoPolicyScope;

    @Column({ type: "uuid", nullable: true })
    modelConfigId?: string;

    @Column({ type: "int", default: 4000 })
    maxPromptLength: number;

    @Column({ type: "int", default: 5 })
    maxMediaItemsPerRequest: number;

    @Column({ type: "int", default: 4 })
    maxReferenceImages: number;

    @Column({ type: "int", default: 300 })
    maxVideoSizeMb: number;

    @Column({ type: "int", default: 20 })
    maxImageSizeMb: number;

    @Column({ type: "int", default: 3 })
    maxConcurrentJobsPerUser: number;

    @Column({ type: "int", default: 100 })
    dailyJobsPerUser: number;

    @Column({ type: "boolean", default: false })
    allowPublicMediaUrl: boolean;

    @Column({ type: "boolean", default: true })
    enabled: boolean;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

    @ManyToOne(() => VideoModelConfig, { nullable: true })
    @JoinColumn({ name: "model_config_id" })
    modelConfig?: VideoModelConfig;
}
