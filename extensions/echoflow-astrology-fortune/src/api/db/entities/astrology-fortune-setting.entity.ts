import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

@ExtensionEntity({ name: "astrology_fortune_settings" })
export class AstrologyFortuneSetting {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, default: "default", unique: true, comment: "Setting key" })
    key: string;

    @Column({ type: "uuid", nullable: true, comment: "Default LLM model ID" })
    defaultModelId?: string | null;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "Daily fortune price" })
    dailyPrice: number;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "General report price" })
    reportPrice: number;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "Compatibility report price" })
    compatibilityPrice: number;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "Decision report price" })
    decisionPrice: number;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Setting metadata" })
    metadata: Record<string, unknown>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
