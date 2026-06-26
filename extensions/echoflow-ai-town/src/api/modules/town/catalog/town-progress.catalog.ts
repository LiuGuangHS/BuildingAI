import type { TownWorldState } from "../../../db/entities";

export type TownTaskTemplate = {
    key: string;
    title: string;
    desc: string;
    type: NonNullable<TownWorldState["dailyTasks"]>[number]["type"];
    target: number;
    reward: { coins?: number; stamina?: number; reputation?: number };
    availableFromDay?: number;
};

export type TownWeeklyGoalTemplate = {
    key: string;
    title: string;
    desc: string;
    type: NonNullable<TownWorldState["weeklyGoal"]>["type"];
    target: number;
    reward: { coins?: number; stamina?: number; reputation?: number };
};

export type TownQuestTemplate = Omit<NonNullable<TownWorldState["mainQuest"]>, "completed">;

export type TownAchievementTemplate = {
    id: string;
    condition: "coins" | "reputation" | "buildingLevel" | "unlockedAreas" | "areaUnlocked";
    target?: number;
    buildingLevel?: number;
    area?: string;
};

export const TOWN_DAILY_TASK_ROTATION: TownTaskTemplate[][] = [
    [
        { key: "operate", title: "开张迎客", desc: "经营餐馆 1 次", type: "operate", target: 1, reward: { coins: 18, reputation: 2 } },
        { key: "visit", title: "街角问候", desc: "拜访居民 1 次", type: "visit", target: 1, reward: { stamina: 8, reputation: 3 } },
        { key: "earn", title: "今日现金流", desc: "累计获得 40 金币", type: "earnCoins", target: 40, reward: { coins: 16 } },
    ],
    [
        { key: "explore", title: "收集传闻", desc: "探索街区 1 次", type: "explore", target: 1, reward: { coins: 12, reputation: 3 } },
        { key: "decorate", title: "点亮街角", desc: "布置小镇 1 次", type: "decorate", target: 1, reward: { reputation: 4 } },
        { key: "rep", title: "人气升温", desc: "累计提升 6 声望", type: "gainReputation", target: 6, reward: { coins: 20 } },
    ],
    [
        { key: "chat", title: "听听居民", desc: "和任意居民聊天 1 次", type: "chat", target: 1, reward: { reputation: 3 } },
        { key: "operate-alt", title: "稳定营业", desc: "经营餐馆 1 次", type: "operate", target: 1, reward: { coins: 22 } },
        { key: "rep-alt", title: "温柔口碑", desc: "累计提升 5 声望", type: "gainReputation", target: 5, reward: { stamina: 8, coins: 12 } },
    ],
    [
        { key: "upgrade", title: "小小修缮", desc: "升级任意建筑 1 次", type: "upgrade", target: 1, reward: { reputation: 6, stamina: 8 }, availableFromDay: 4 },
        { key: "chat", title: "听听居民", desc: "和任意居民聊天 1 次", type: "chat", target: 1, reward: { reputation: 3 }, availableFromDay: 4 },
        { key: "operate-alt", title: "稳定营业", desc: "经营餐馆 1 次", type: "operate", target: 1, reward: { coins: 22 }, availableFromDay: 4 },
    ],
];

export const TOWN_WEEKLY_GOAL_ROTATION: TownWeeklyGoalTemplate[] = [
    { key: "weekly-tasks", title: "一周小镇清单", desc: "完成 5 个每日任务", type: "completeTasks", target: 5, reward: { coins: 90, reputation: 12 } },
    { key: "weekly-rep", title: "人气小镇", desc: "累计提升 30 声望", type: "gainReputation", target: 30, reward: { coins: 120, stamina: 20 } },
    { key: "weekly-explore", title: "街区地图", desc: "探索街区 5 次", type: "explore", target: 5, reward: { coins: 80, reputation: 10 } },
];

export const TOWN_MAIN_QUEST_CATALOG: Record<number, TownQuestTemplate> = {
    1: { chapter: 1, title: "开业准备", desc: "让乐园小镇稳定运转起来。", requirements: [{ type: "level", target: 2, current: 1 }, { type: "reputation", target: 20, current: 0 }], reward: { coins: 80, reputation: 8 } },
    2: { chapter: 2, title: "稳定餐馆", desc: "把暖光餐馆打造成居民每天想来的地方。", requirements: [{ type: "building:restaurant", target: 2, current: 1 }, { type: "coins", target: 180, current: 0 }], reward: { reputation: 12, unlockArea: "夜市街角" } },
    3: { chapter: 3, title: "修复广场", desc: "让中央广场重新成为小镇活动中心。", requirements: [{ type: "building:square", target: 3, current: 1 }, { type: "reputation", target: 60, current: 0 }], reward: { coins: 160, reputation: 18, unlockArea: "旧喷泉" } },
    4: { chapter: 4, title: "灯会筹备", desc: "筹备第一场属于居民的小镇灯会。", requirements: [{ type: "area", target: 1, current: 0 }, { type: "reputation", target: 90, current: 0 }], reward: { coins: 220, reputation: 24, unlockArea: "庆典会场" } },
};

export const TOWN_ACHIEVEMENT_CATALOG: TownAchievementTemplate[] = [
    { id: "第一桶金", condition: "coins", target: 300 },
    { id: "人气初现", condition: "reputation", target: 50 },
    { id: "建筑师", condition: "buildingLevel", buildingLevel: 5 },
    { id: "探索者", condition: "unlockedAreas", target: 5 },
    { id: "庆典小镇", condition: "areaUnlocked", area: "庆典会场" },
];

export function createTownDailyTasks(day: number) {
    const available = TOWN_DAILY_TASK_ROTATION.filter((tasks) => tasks.every((task) => !task.availableFromDay || day >= task.availableFromDay));
    const rotation = available.length ? available : TOWN_DAILY_TASK_ROTATION.slice(0, 3);
    return rotation[(day - 1) % rotation.length].map((task) => ({
        id: `${task.key}-${day}`,
        title: task.title,
        desc: task.desc,
        type: task.type,
        target: task.target,
        progress: 0,
        reward: { ...task.reward },
        completed: false,
    }));
}

export function createTownWeeklyGoal(day = 1) {
    const week = Math.ceil(day / 7);
    const template = TOWN_WEEKLY_GOAL_ROTATION[(week - 1) % TOWN_WEEKLY_GOAL_ROTATION.length];
    return {
        id: `${template.key}-${week}`,
        title: template.title,
        desc: template.desc,
        type: template.type,
        target: template.target,
        progress: 0,
        reward: { ...template.reward },
        completed: false,
    };
}

export function createTownMainQuest(chapter: number) {
    const template = TOWN_MAIN_QUEST_CATALOG[chapter];
    if (!template) {
        // 终态：所有章节已完成，不再发放奖励（修复章节 4 无限重复完成 Bug）
        const lastChapter = Math.max(...Object.keys(TOWN_MAIN_QUEST_CATALOG).map(Number));
        return {
            chapter: lastChapter,
            title: "乐园圆满",
            desc: "所有章节已完成，乐园已达至圆满状态。",
            requirements: [],
            reward: {},
            completed: true,
        };
    }
    return {
        chapter: template.chapter,
        title: template.title,
        desc: template.desc,
        requirements: template.requirements.map((requirement) => ({ ...requirement })),
        reward: { ...template.reward },
        completed: false,
    };
}
