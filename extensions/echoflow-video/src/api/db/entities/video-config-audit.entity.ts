import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
} from "@buildingai/db/typeorm";

@ExtensionEntity()
export class VideoConfigAudit {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 80, comment: "Audit action" })
    action: string;

    @Column({ type: "varchar", length: 80, nullable: true, comment: "Operator user id if available" })
    operatorId?: string;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Sanitized config snapshot" })
    snapshot: Record<string, unknown>;

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;
}
