import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import type { VideoAbilityType, VideoModelDefaultParams } from "./video-model-config.entity";
import { VideoModelConfig } from "./video-model-config.entity";

@ExtensionEntity()
export class VideoPromptTemplate {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 120 })
    title: string;

    @Column({ type: "varchar", length: 80, default: "default" })
    category: string;

    @Column({ type: "text" })
    prompt: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Applicable ability types" })
    abilityTypes: VideoAbilityType[];

    @Column({ type: "uuid", nullable: true, comment: "Optional model config ID" })
    modelConfigId?: string;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Default generation params" })
    defaultParams: VideoModelDefaultParams;

    @Column({ type: "varchar", length: 1000, nullable: true })
    coverImageUrl?: string;

    @Column({ type: "boolean", default: true })
    enabled: boolean;

    @Column({ type: "int", default: 0 })
    sortOrder: number;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;

    @ManyToOne(() => VideoModelConfig, { nullable: true })
    @JoinColumn({ name: "model_config_id" })
    modelConfig?: VideoModelConfig;
}
