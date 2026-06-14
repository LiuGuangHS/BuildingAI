import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, Index, PrimaryGeneratedColumn } from "@buildingai/db/typeorm";

@ExtensionEntity({ name: "town_ai_call_logs", comment: "AI town generation call logs" })
export class TownAiCallLog {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id!: string;

    @Column({ type: "uuid", nullable: true, comment: "Owner user id" })
    @Index()
    userId?: string | null;

    @Column({ type: "uuid", nullable: true, comment: "Save id" })
    @Index()
    saveId?: string | null;

    @Column({ type: "varchar", length: 40, comment: "AI call type" })
    type!: "advice" | "chat" | "event" | "structured_event" | "test";

    @Column({ type: "uuid", nullable: true, comment: "Model id" })
    modelId?: string | null;

    @Column({ type: "boolean", default: false, comment: "Whether call succeeded" })
    success!: boolean;

    @Column({ type: "boolean", default: false, comment: "Whether local fallback was used" })
    fallbackUsed!: boolean;

    @Column({ type: "int", default: 0, comment: "Elapsed milliseconds" })
    latencyMs!: number;

    @Column({ type: "text", nullable: true, comment: "Error message" })
    errorMessage?: string | null;

    @Column({ type: "jsonb", nullable: true, comment: "Usage payload" })
    usage?: Record<string, unknown> | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
}
