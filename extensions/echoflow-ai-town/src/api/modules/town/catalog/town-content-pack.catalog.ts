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
    seasonId: TownContentSeasonId;
    seededAt: string;
    seedStrategy: TownContentPackManifest["seedStrategy"];
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
        buildings: ["restaurant", "florist", "square"],
        areas: ["中央广场", "暖光餐馆", "花店街角", "夜市街角", "二层露台", "温室小径", "旧喷泉", "庆典会场"],
        characters: ["小满", "阿泽", "花音", "旅人洛"],
        actions: ["operate", "visit", "decorate", "explore", "rest", "advice"],
        choices: ["operate", "visit", "explore", "rest"],
        dailyTaskRotations: 4,
        weeklyGoals: 3,
        mainQuestChapters: [1, 2, 3, 4],
        achievements: ["第一桶金", "人气初现", "建筑师", "探索者", "庆典小镇"],
        festivals: ["festival-lantern", "restaurant-new-menu", "florist-show", "fountain-repair"],
    },
};

export function createTownContentPackState(seededAt = new Date().toISOString()): TownContentPackState {
    return {
        packId: TOWN_CONTENT_PACK_MANIFEST.id,
        version: TOWN_CONTENT_PACK_MANIFEST.version,
        seasonId: TOWN_CONTENT_PACK_MANIFEST.season.id,
        seededAt,
        seedStrategy: { ...TOWN_CONTENT_PACK_MANIFEST.seedStrategy },
    };
}

export function normalizeTownContentPackState(state: unknown): TownContentPackState {
    const source = state && typeof state === "object" ? state as Partial<TownContentPackState> : {};
    const fallback = createTownContentPackState();

    return {
        packId: source.packId === TOWN_CONTENT_PACK_MANIFEST.id ? source.packId : fallback.packId,
        version: typeof source.version === "string" && source.version.trim() ? source.version : fallback.version,
        seasonId: source.seasonId === TOWN_CONTENT_PACK_MANIFEST.season.id ? source.seasonId : fallback.seasonId,
        seededAt: typeof source.seededAt === "string" && source.seededAt.trim() ? source.seededAt : fallback.seededAt,
        seedStrategy: {
            ...fallback.seedStrategy,
            ...(source.seedStrategy && typeof source.seedStrategy === "object" ? source.seedStrategy : {}),
        },
    };
}
