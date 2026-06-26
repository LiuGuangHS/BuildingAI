import { TOWN_ACTION_CATALOG } from "./town-actions.catalog";
import { TOWN_BUILDING_CATALOG } from "./town-buildings.catalog";
import { TOWN_CHARACTER_CATALOG } from "./town-characters.catalog";
import { TOWN_CHOICE_CATALOG } from "./town-choices.catalog";
import { TOWN_FESTIVAL_CATALOG } from "./town-festivals.catalog";
import { TOWN_ACHIEVEMENT_CATALOG, TOWN_DAILY_TASK_ROTATION, TOWN_MAIN_QUEST_CATALOG, TOWN_WEEKLY_GOAL_ROTATION } from "./town-progress.catalog";

export type TownContentPackId = "launch-core";
export type TownContentSeasonId = "season-0";

export type TownContentPackManifest = {
    id: TownContentPackId;
    version: string;
    season: {
        id: TownContentSeasonId;
        title: string;
        startsAt: string;
        endsAt?: string;
    };
    seedStrategy: {
        mode: "first-install";
        shouldRun: "create-save" | "upgrade-normalize";
        idempotencyKey: string;
    };
    includes: {
        buildings: string[];
        areas: string[];
        characters: string[];
        actions: string[];
        choices: string[];
        dailyTaskRotations: number;
        weeklyGoals: number;
        mainQuestChapters: number[];
        achievements: string[];
        festivals: string[];
    };
};

export type TownContentPackState = {
    packId: TownContentPackId;
    version: string;
    seededAt: string;
    seasonId?: TownContentSeasonId;
    seedStrategy?: TownContentPackManifest["seedStrategy"];
};

export const TOWN_CONTENT_PACK_MANIFEST: TownContentPackManifest = {
    id: "launch-core",
    version: "0.0.1",
    season: {
        id: "season-0",
        title: "开业季",
        startsAt: "2026-06-01",
    },
    seedStrategy: {
        mode: "first-install",
        shouldRun: "create-save",
        idempotencyKey: "echoflow-ai-town:launch-core:0.0.1",
    },
    includes: {
        buildings: TOWN_BUILDING_CATALOG.map((building) => building.id),
        areas: ["中央广场", "暖光餐馆", "花店街角", "夜市街角", "二层露台", "温室小径", "旧喷泉", "庆典会场"],
        characters: TOWN_CHARACTER_CATALOG.map((character) => character.name),
        actions: Object.keys(TOWN_ACTION_CATALOG),
        choices: Object.keys(TOWN_CHOICE_CATALOG),
        dailyTaskRotations: TOWN_DAILY_TASK_ROTATION.length,
        weeklyGoals: TOWN_WEEKLY_GOAL_ROTATION.length,
        mainQuestChapters: Object.keys(TOWN_MAIN_QUEST_CATALOG).map(Number),
        achievements: TOWN_ACHIEVEMENT_CATALOG.map((achievement) => achievement.id),
        festivals: TOWN_FESTIVAL_CATALOG.map((festival) => festival.key),
    },
};

export function createTownContentPackState(seededAt = new Date().toISOString()): TownContentPackState {
    return {
        packId: TOWN_CONTENT_PACK_MANIFEST.id,
        version: TOWN_CONTENT_PACK_MANIFEST.version,
        seededAt,
    };
}

export function normalizeTownContentPackState(state: unknown): TownContentPackState {
    const source = state && typeof state === "object" ? state as Partial<TownContentPackState> : {};
    const fallback = createTownContentPackState();

    return {
        packId: source.packId === TOWN_CONTENT_PACK_MANIFEST.id ? source.packId : fallback.packId,
        version: typeof source.version === "string" && source.version.trim() ? source.version : fallback.version,
        seededAt: typeof source.seededAt === "string" && source.seededAt.trim() ? source.seededAt : fallback.seededAt,
    };
}
