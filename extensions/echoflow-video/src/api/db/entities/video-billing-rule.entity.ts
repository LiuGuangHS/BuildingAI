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

export interface VideoBillingMultipliers {
    [key: string]: number;
}

@ExtensionEntity()
export class VideoBillingRule {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid", nullable: true, comment: "Video model config ID" })
    modelConfigId?: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    baseCost: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 2 })
    perSecondCost: number;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Resolution cost multipliers" })
    resolutionMultipliers: VideoBillingMultipliers;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 1 })
    minimumCost: number;

    @Column({ type: "boolean", default: true })
    refundOnFailure: boolean;

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
