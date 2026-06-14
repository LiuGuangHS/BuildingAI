import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

@ExtensionEntity({ name: "contract_generation_configs" })
export class ContractGenerationConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, default: "default", unique: true, comment: "Config key" })
    key: string;

    @Column({ type: "uuid", nullable: true, comment: "Fixed LLM model ID" })
    modelId?: string | null;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Extra config" })
    metadata: Record<string, unknown>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;
}
