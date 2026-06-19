import { ExtensionEntity } from "@buildingai/core/decorators";
import type { Relation } from "@buildingai/db/typeorm";
import { Column, CreateDateColumn, DeleteDateColumn, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

import { TownSave } from "./town-save.entity";

export type TownCharacterMemory = {
    summary?: string;
    relationshipLevel?: string;
    mood?: string;
    preferences?: string[];
    promises?: string[];
    keyMoments?: Array<{ day: number; title: string; summary: string }>;
    recentMessages?: Array<{ user: string; reply: string; at: string }>;
    lastMessage?: string;
    lastReply?: string;
    lastEventTitle?: string;
};

@ExtensionEntity({ name: "town_characters", comment: "AI town NPCs" })
export class TownCharacter {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id!: string;

    @Column({ type: "uuid", comment: "Owner user id" })
    @Index()
    userId!: string;

    @Column({ type: "uuid", comment: "Save id" })
    @Index()
    saveId!: string;

    @Column({ type: "varchar", length: 80, comment: "NPC name" })
    name!: string;

    @Column({ type: "varchar", length: 80, comment: "NPC role" })
    role!: string;

    @Column({ type: "varchar", length: 200, comment: "NPC personality" })
    personality!: string;

    @Column({ type: "int", default: 20, comment: "Relationship score" })
    relationship!: number;

    @Column({ type: "varchar", length: 80, default: "日常", comment: "NPC status" })
    status!: string;

    @Column({ type: "jsonb", nullable: true, comment: "NPC memories" })
    memory?: TownCharacterMemory | null;

    @ManyToOne(
        () => TownSave,
        (save) => save.characters,
        { onDelete: "CASCADE" },
    )
    @JoinColumn({ name: "save_id" })
    save!: Relation<TownSave>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
