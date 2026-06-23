import { ExtensionEntity } from "@buildingai/core/decorators";
import type { Relation } from "@buildingai/db/typeorm";
import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "@buildingai/db/typeorm";

import { TownCharacter } from "./town-character.entity";
import { TownEvent } from "./town-event.entity";

export type TownWorldState = {
    contentPack?: {
        packId: "launch-core";
        version: string;
        seasonId: "season-0";
        seededAt: string;
        seedStrategy: {
            mode: "first-install";
            shouldRun: "create-save" | "upgrade-normalize";
            idempotencyKey: string;
        };
    };
    reputation: number;
    weather: string;
    focus: string;
    unlockedAreas: string[];
    buildings: Array<{
        id: string;
        name: string;
        level: number;
        status: string;
        effect?: string;
        maxLevel?: number;
    }>;
    flags?: Record<string, unknown>;
    dailyTasks?: Array<{
        id: string;
        title: string;
        desc: string;
        type: "operate" | "visit" | "explore" | "decorate" | "upgrade" | "chat" | "earnCoins" | "gainReputation";
        target: number;
        progress: number;
        reward: { coins?: number; stamina?: number; reputation?: number };
        completed: boolean;
    }>;
    weeklyGoal?: {
        id: string;
        title: string;
        desc: string;
        type: "completeTasks" | "upgrade" | "gainReputation" | "explore";
        target: number;
        progress: number;
        reward: { coins?: number; stamina?: number; reputation?: number };
        completed: boolean;
    } | null;
    mainQuest?: {
        chapter: number;
        title: string;
        desc: string;
        requirements: Array<{ type: string; target: number; current: number }>;
        reward: { coins?: number; reputation?: number; unlockArea?: string };
        completed: boolean;
    };
    achievements?: string[];
    activeFestival?: {
        key: string;
        title: string;
        desc: string;
        status: "announced" | "preparing" | "ready" | "completed";
        progress: number;
        target: number;
        daysLeft: number;
        action: "operate" | "visit" | "decorate" | "explore" | "upgrade";
        reward: { coins?: number; reputation?: number; stamina?: number; relationship?: Record<string, number>; unlockArea?: string };
    } | null;
    lastSettlement?: {
        day: number;
        weather: string;
        income: number;
        maintenance: number;
        reputation: number;
        summary: string;
        breakdown?: Array<{ label: string; value: number; detail: string }>;
    } | null;
    retention?: {
        streak: number;
        lastQualifiedDay: number;
        todayQualified: boolean;
        nextHook: {
            day: number;
            title: string;
            desc: string;
            action: "operate" | "visit" | "decorate" | "explore" | "upgrade" | "chat" | "rest";
            target?: string;
            targetLabel: string;
            reason: string;
            reward?: {
                label: string;
                coins?: number;
                stamina?: number;
                reputation?: number;
            };
        };
    };
};

@ExtensionEntity({ name: "town_saves", comment: "AI town save slots" })
export class TownSave {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id!: string;

    @Column({ type: "uuid", comment: "Owner user id" })
    @Index()
    userId!: string;

    @Column({ type: "varchar", length: 120, comment: "Town name" })
    name!: string;

    @Column({ type: "int", default: 1, comment: "Town level" })
    level!: number;

    @Column({ type: "int", default: 120, comment: "Town coins" })
    coins!: number;

    @Column({ type: "int", default: 100, comment: "Player stamina" })
    stamina!: number;

    @Column({ type: "int", default: 1, comment: "Current town day" })
    day!: number;

    @Column({ type: "varchar", length: 60, default: "期待", comment: "Town mood" })
    mood!: string;

    @Column({ type: "jsonb", nullable: true, comment: "World simulation state" })
    worldState?: TownWorldState | null;

    @OneToMany(
        () => TownCharacter,
        (character) => character.save,
        { cascade: true },
    )
    characters!: Relation<TownCharacter[]>;

    @OneToMany(
        () => TownEvent,
        (event) => event.save,
        { cascade: true },
    )
    events!: Relation<TownEvent[]>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
