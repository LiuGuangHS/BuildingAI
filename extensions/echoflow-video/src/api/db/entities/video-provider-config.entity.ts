import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

@ExtensionEntity()
export class VideoProviderConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, unique: true, default: "happyhorse" })
    provider: string;

    @Column({ type: "boolean", default: true, comment: "Whether prompt optimizer is enabled" })
    promptOptimizerEnabled: boolean;

    @Column({ type: "uuid", nullable: true, comment: "Main-system AI model id for prompt optimization" })
    promptOptimizerModelId?: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Allowed main-system AI model ids for prompt optimization" })
    promptOptimizerAllowedModelIds: string[];

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
