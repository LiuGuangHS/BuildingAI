import type { TownActionDto } from "../dto";

export type TownActionCatalogKey = Exclude<TownActionDto["action"], "upgrade">;

type CatalogValue<T> = T | ((context: TownActionCatalogContext) => T);

export type TownActionCatalogItem = {
    title: CatalogValue<string>;
    content: CatalogValue<string>;
    stamina: CatalogValue<number>;
    coins?: CatalogValue<number>;
    reputation?: CatalogValue<number>;
    mood: CatalogValue<string>;
    focus: string;
    reserved?: boolean;
    experimental?: boolean;
};

export type TownActionCatalogContext = {
    restaurantLevel: number;
    floristLevel: number;
    squareLevel: number;
    weather: string;
    weatherEffect: {
        operateCoins: number;
        visitReputation: number;
        exploreReputation: number;
        exploreStaminaCost: number;
        reputationMultiplier: number;
    };
    suggestion: string;
    mood: string;
};

export const TOWN_ACTION_CATALOG: Record<TownActionCatalogKey, TownActionCatalogItem> = {
    operate: {
        title: "暖光餐馆开张",
        content: "你把今日菜单改成番茄炖菜和烤面包。午后雨停时，几位居民排队进店，小满记下了大家最喜欢的口味。",
        coins: ({ restaurantLevel, weatherEffect }) => Math.round((32 + restaurantLevel * 8) * weatherEffect.operateCoins),
        stamina: -18,
        reputation: 3,
        mood: "充实",
        focus: "餐馆经营",
    },
    visit: {
        title: "街角拜访",
        content: "你带着新鲜点心去花店街角串门。花音建议在广场摆一张留言桌，让居民写下明天想参加的活动。",
        coins: -6,
        stamina: -10,
        reputation: ({ floristLevel, weatherEffect }) => 3 + floristLevel + weatherEffect.visitReputation,
        mood: "亲近",
        focus: "居民关系",
    },
    decorate: {
        title: "小镇布置日",
        content: "你把旧木箱改成花架，又在门口挂上暖黄色小灯。夜幕降临时，路过的居民都停下来看了一会儿。",
        coins: -24,
        stamina: -14,
        reputation: ({ floristLevel }) => 4 + floristLevel,
        mood: "焕新",
        focus: "街区美化",
    },
    explore: {
        title: ({ weather }) => `${weather}街区探索`,
        content: "你沿着石板路走到还没修好的旧喷泉旁，发现一张被雨水打湿的活动清单：周末也许可以办一场小型灯会。",
        coins: ({ squareLevel }) => 8 + squareLevel * 4,
        stamina: ({ weatherEffect }) => -16 - weatherEffect.exploreStaminaCost,
        reputation: ({ squareLevel, weatherEffect }) => 1 + squareLevel + weatherEffect.exploreReputation,
        mood: "好奇",
        focus: "开放探索",
    },
    rest: {
        title: "休息一晚",
        content: "你提前关店，和居民们一起在厨房喝热汤。第二天清晨，小镇恢复了元气，新的机会也在公告板上出现。",
        coins: 0,
        stamina: 42,
        reputation: ({ weatherEffect }) => Math.round(1 * weatherEffect.reputationMultiplier),
        mood: "治愈",
        focus: "恢复体力",
    },
    advice: {
        title: "今日计划",
        content: ({ suggestion }) => suggestion,
        coins: 0,
        stamina: 0,
        reputation: 0,
        mood: ({ mood }) => mood,
        focus: "经营规划",
    },
};

export function resolveTownActionCatalogValue<T>(value: CatalogValue<T>, context: TownActionCatalogContext): T {
    return typeof value === "function" ? (value as (context: TownActionCatalogContext) => T)(context) : value;
}
