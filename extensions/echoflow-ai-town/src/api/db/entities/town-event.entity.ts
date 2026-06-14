import { ExtensionEntity } from "@buildingai/core/decorators";
import type { Relation } from "@buildingai/db/typeorm";
import { Column, CreateDateColumn, DeleteDateColumn, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "@buildingai/db/typeorm";

import { TownSave } from "./town-save.entity";

export type TownEventChoice = {
    id: string;
    label: string;
    hint: string;
};

export type TownEventResult = {
    coins?: number;
    stamina?: number;
    reputation?: number;
    relationship?: Record<string, number>;
    bonuses?: string[];
    strategy?: {
        summary: string;
        action: string;
        target: string;
        reason: string;
        risk: string;
        expected: string;
        nextStep: string;
    };
    fallbackUsed?: boolean;
};

@ExtensionEntity({ name: "town_events", comment: "AI town event log" })
export class TownEvent {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id!: string;

    @Column({ type: "uuid", comment: "Owner user id" })
    @Index()
    userId!: string;

    @Column({ type: "uuid", comment: "Save id" })
    @Index()
    saveId!: string;

    @Column({ type: "varchar", length: 60, comment: "Event type" })
    type!: string;

    @Column({ type: "varchar", length: 160, comment: "Event title" })
    title!: string;

    @Column({ type: "text", comment: "Event content" })
    content!: string;

    @Column({ type: "jsonb", nullable: true, comment: "Event choices" })
    choices?: TownEventChoice[] | null;

    @Column({ type: "jsonb", nullable: true, comment: "Applied result" })
    result?: TownEventResult | null;

    @ManyToOne(
        () => TownSave,
        (save) => save.events,
        { onDelete: "CASCADE" },
    )
    @JoinColumn({ name: "save_id" })
    save!: Relation<TownSave>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
