import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

export interface PromptTemplate {
    label: string;
    prompt: string;
}

@ExtensionEntity()
export class VideoProviderConfig {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, unique: true, default: "happyhorse" })
    provider: string;

    @Column({ type: "uuid", nullable: true, comment: "Main-system Secret id for provider callback verification" })
    webhookSecretId?: string;

    @Column({ type: "varchar", length: 120, nullable: true, comment: "Main-system Secret display name for callbacks" })
    webhookSecretName?: string;

    @Column({ type: "boolean", default: true, comment: "Whether prompt optimizer is enabled" })
    promptOptimizerEnabled: boolean;

    @Column({ type: "uuid", nullable: true, comment: "Main-system AI model id for prompt optimization" })
    promptOptimizerModelId?: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Allowed main-system AI model ids for prompt optimization" })
    promptOptimizerAllowedModelIds: string[];

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Prompt templates for quick fill" })
    templates: PromptTemplate[];

    @CreateDateColumn({ comment: "Created time" })
    createdAt: Date;

    @UpdateDateColumn({ comment: "Updated time" })
    updatedAt: Date;
}
