import { ExtensionEntity } from "@buildingai/core/decorators";
import {
    Column,
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import type { ImageModelDefaultParams } from "./image-model-config.entity";

@ExtensionEntity()
export class ImagePromptTemplate {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 120 })
    title: string;

    @Column({ type: "varchar", length: 80, default: "default" })
    category: string;

    @Column({ type: "text" })
    prompt: string;

    @Column({ type: "text", nullable: true })
    negativePrompt?: string;

    @Column({ type: "jsonb", default: () => "'{}'" })
    defaultParams: ImageModelDefaultParams;

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
}
