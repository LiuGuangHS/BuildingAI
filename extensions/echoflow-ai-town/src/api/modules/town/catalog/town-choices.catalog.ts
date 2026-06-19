import type { TownEventChoice } from "../../../db/entities";

export type TownChoiceActionOverride = {
    title: string;
    content: string;
    coins: number;
    stamina: number;
    reputation: number;
    mood: string;
    focus: string;
};

export const TOWN_CHOICE_CATALOG: Record<string, TownEventChoice> = {
    operate: { id: "operate", label: "继续经营", hint: "稳定赚取金币" },
    visit: { id: "visit", label: "找居民聊聊", hint: "提升小镇氛围" },
    explore: { id: "explore", label: "追踪线索", hint: "发现新的街区事件" },
    rest: { id: "rest", label: "休息一天", hint: "恢复体力并推进日期" },
};

export const TOWN_CHOICE_ACTION_OVERRIDES: Record<string, TownChoiceActionOverride> = {
    operate: {
        title: "选项推进：继续经营",
        content: "你顺着上一条线索回到餐馆，把今日菜单改成更稳妥的套餐。熟客们很快坐满靠窗的位置，账本上的现金流重新变得安心。",
        coins: 42,
        stamina: -20,
        reputation: 3,
        mood: "笃定",
        focus: "稳定经营",
    },
    visit: {
        title: "选项推进：找居民聊聊",
        content: "你带着刚得到的线索拜访居民。大家围在公告板前补充细节，一场小型街角活动慢慢有了雏形。",
        coins: -4,
        stamina: -10,
        reputation: 6,
        mood: "亲近",
        focus: "居民协作",
    },
    explore: {
        title: "选项推进：继续探索",
        content: "你沿着线索继续往旧街区深处走去，在墙角发现一枚写着日期的木牌，也许明天这里会出现新的访客。",
        coins: 14,
        stamina: -18,
        reputation: 3,
        mood: "好奇",
        focus: "线索探索",
    },
    rest: {
        title: "选项推进：休息一天",
        content: "你把今天的发现写进小镇日志，然后早早休息。第二天醒来时，门缝下多了一张居民留下的小纸条。",
        coins: 0,
        stamina: 48,
        reputation: 1,
        mood: "治愈",
        focus: "恢复体力",
    },
};

export function createTownChoiceCatalog(): Record<string, TownEventChoice> {
    return Object.fromEntries(Object.entries(TOWN_CHOICE_CATALOG).map(([key, choice]) => [key, { ...choice }]));
}
