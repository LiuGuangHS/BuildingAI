import type { TownWorldState } from "../../../db/entities";

export type TownFestivalTemplate = Omit<NonNullable<TownWorldState["activeFestival"]>, "status" | "progress"> & {
    unlock: {
        day?: number;
        reputation?: number;
        building?: string;
        buildingLevel?: number;
    };
};

export const TOWN_FESTIVAL_CATALOG: TownFestivalTemplate[] = [
    {
        key: "festival-lantern",
        title: "暖光灯会",
        desc: "居民正在筹备夜晚灯会，继续拜访居民可以收集愿望纸条。",
        target: 2,
        daysLeft: 3,
        action: "visit",
        reward: { coins: 48, reputation: 10 },
        unlock: { day: 5, reputation: 45 },
    },
    {
        key: "restaurant-new-menu",
        title: "餐馆新品日",
        desc: "小满想试做一份新品套餐，连续经营餐馆可以完成试吃会。",
        target: 2,
        daysLeft: 3,
        action: "operate",
        reward: { coins: 72, reputation: 5 },
        unlock: { building: "restaurant", buildingLevel: 3 },
    },
    {
        key: "florist-show",
        title: "花店街角展",
        desc: "花音准备把街角布置成花展，继续布置小镇可以完成展台。",
        target: 2,
        daysLeft: 3,
        action: "decorate",
        reward: { coins: 36, reputation: 12 },
        unlock: { building: "florist", buildingLevel: 3 },
    },
    {
        key: "fountain-repair",
        title: "旧喷泉修复日",
        desc: "旧喷泉传来新的水声，继续探索广场可以找到修复线索。",
        target: 2,
        daysLeft: 3,
        action: "explore",
        reward: { coins: 40, reputation: 8, unlockArea: "喷泉夜话" },
        unlock: { building: "square", buildingLevel: 3 },
    },
];

export function createTownFestivalState(template: TownFestivalTemplate) {
    return {
        key: template.key,
        title: template.title,
        desc: template.desc,
        status: "announced" as const,
        progress: 0,
        target: template.target,
        daysLeft: template.daysLeft,
        action: template.action,
        reward: { ...template.reward },
    };
}
