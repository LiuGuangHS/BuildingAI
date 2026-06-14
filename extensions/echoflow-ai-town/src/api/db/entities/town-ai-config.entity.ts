import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

@ExtensionEntity({ name: "town_ai_configs", comment: "AI town model configuration" })
export class TownAiConfig {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "boolean", default: false, comment: "Whether AI generation is enabled" })
    enabled!: boolean;

    @Column({ type: "uuid", nullable: true, comment: "Default AI model id" })
    defaultModelId?: string | null;

    @Column({ type: "float", default: 0.8, comment: "Generation temperature" })
    temperature!: number;

    @Column({ type: "int", default: 1200, comment: "Maximum output tokens" })
    maxTokens!: number;

    @Column({ type: "boolean", default: true, comment: "Fallback to local rules when AI fails" })
    fallbackToRules!: boolean;

    @Column({ type: "int", default: 100, comment: "Daily AI call limit per user" })
    dailyLimitPerUser!: number;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;
}
