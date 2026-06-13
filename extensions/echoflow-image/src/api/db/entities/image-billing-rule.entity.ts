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

export interface ImageBillingMultipliers {
    [key: string]: number;
}

@ExtensionEntity()
export class ImageBillingRule {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", nullable: true, comment: "Image model config ID" })
    modelConfigId?: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 1 })
    baseCost: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 1 })
    textToImageMultiplier: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 1.5 })
    imageToImageMultiplier: number;

    @Column({ type: "jsonb", default: () => "'{}'" })
    qualityMultipliers: ImageBillingMultipliers;

    @Column({ type: "jsonb", default: () => "'{}'" })
    sizeMultipliers: ImageBillingMultipliers;

    @Column({ type: "boolean", default: true })
    countMultiplierEnabled: boolean;

    @Column({ type: "boolean", default: true })
    refundOnFailure: boolean;

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
