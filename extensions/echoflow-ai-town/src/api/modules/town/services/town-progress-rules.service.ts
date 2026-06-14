import { Injectable } from "@nestjs/common";

import type { TownSave, TownWorldState } from "../../../db/entities";
import type { TownActionDto } from "../dto";

export type TownTask = NonNullable<TownWorldState["dailyTasks"]>[number];
export type TownGoal = NonNullable<TownWorldState["weeklyGoal"]>;
export type TownQuestState = NonNullable<TownWorldState["mainQuest"]>;
export type ProgressContext = {
    action?: TownActionDto["action"] | "chat";
    coinsDelta?: number;
    reputationDelta?: number;
    completedTasks?: number;
};

export type ProgressResult = {
    completedTasks: TownTask[];
    completedWeeklyGoal: TownGoal | null;
    questCompleted: TownQuestState | null;
    achievements: string[];
};

@Injectable()
export class TownProgressRulesService {
    createDailyTasks(day: number): TownTask[] {
        const earlyVariants: TownTask[][] = [
            [
                { id: `operate-${day}`, title: "开张迎客", desc: "经营餐馆 1 次", type: "operate", target: 1, progress: 0, reward: { coins: 18, reputation: 2 }, completed: false },
                { id: `visit-${day}`, title: "街角问候", desc: "拜访居民 1 次", type: "visit", target: 1, progress: 0, reward: { stamina: 8, reputation: 3 }, completed: false },
                { id: `earn-${day}`, title: "今日现金流", desc: "累计获得 40 金币", type: "earnCoins", target: 40, progress: 0, reward: { coins: 16 }, completed: false },
            ],
            [
                { id: `explore-${day}`, title: "收集传闻", desc: "探索街区 1 次", type: "explore", target: 1, progress: 0, reward: { coins: 12, reputation: 3 }, completed: false },
                { id: `decorate-${day}`, title: "点亮街角", desc: "布置小镇 1 次", type: "decorate", target: 1, progress: 0, reward: { reputation: 4 }, completed: false },
                { id: `rep-${day}`, title: "人气升温", desc: "累计提升 6 声望", type: "gainReputation", target: 6, progress: 0, reward: { coins: 20 }, completed: false },
            ],
            [
                { id: `chat-${day}`, title: "听听居民", desc: "和任意居民聊天 1 次", type: "chat", target: 1, progress: 0, reward: { reputation: 3 }, completed: false },
                { id: `operate-alt-${day}`, title: "稳定营业", desc: "经营餐馆 1 次", type: "operate", target: 1, progress: 0, reward: { coins: 22 }, completed: false },
                { id: `rep-alt-${day}`, title: "温柔口碑", desc: "累计提升 5 声望", type: "gainReputation", target: 5, progress: 0, reward: { stamina: 8, coins: 12 }, completed: false },
            ],
        ];
        const advancedVariants: TownTask[][] = [
            ...earlyVariants,
            [
                { id: `upgrade-${day}`, title: "小小修缮", desc: "升级任意建筑 1 次", type: "upgrade", target: 1, progress: 0, reward: { reputation: 6, stamina: 8 }, completed: false },
                { id: `chat-${day}`, title: "听听居民", desc: "和任意居民聊天 1 次", type: "chat", target: 1, progress: 0, reward: { reputation: 3 }, completed: false },
                { id: `operate-alt-${day}`, title: "稳定营业", desc: "经营餐馆 1 次", type: "operate", target: 1, progress: 0, reward: { coins: 22 }, completed: false },
            ],
        ];
        const variants = day <= 3 ? earlyVariants : advancedVariants;
        return variants[(day - 1) % variants.length];
    }

    createWeeklyGoal(day = 1): TownGoal {
        const goals: TownGoal[] = [
            { id: `weekly-tasks-${Math.ceil(day / 7)}`, title: "一周小镇清单", desc: "完成 5 个每日任务", type: "completeTasks", target: 5, progress: 0, reward: { coins: 90, reputation: 12 }, completed: false },
            { id: `weekly-rep-${Math.ceil(day / 7)}`, title: "人气小镇", desc: "累计提升 30 声望", type: "gainReputation", target: 30, progress: 0, reward: { coins: 120, stamina: 20 }, completed: false },
            { id: `weekly-explore-${Math.ceil(day / 7)}`, title: "街区地图", desc: "探索街区 5 次", type: "explore", target: 5, progress: 0, reward: { coins: 80, reputation: 10 }, completed: false },
        ];
        return goals[Math.floor((day - 1) / 7) % goals.length];
    }

    createMainQuest(chapter: number): TownQuestState {
        const quests: Record<number, TownQuestState> = {
            1: { chapter: 1, title: "开业准备", desc: "让乐园小镇稳定运转起来。", requirements: [{ type: "level", target: 2, current: 1 }, { type: "reputation", target: 20, current: 0 }], reward: { coins: 80, reputation: 8 }, completed: false },
            2: { chapter: 2, title: "稳定餐馆", desc: "把暖光餐馆打造成居民每天想来的地方。", requirements: [{ type: "building:restaurant", target: 2, current: 1 }, { type: "coins", target: 180, current: 0 }], reward: { reputation: 12, unlockArea: "夜市街角" }, completed: false },
            3: { chapter: 3, title: "修复广场", desc: "让中央广场重新成为小镇活动中心。", requirements: [{ type: "building:square", target: 3, current: 1 }, { type: "reputation", target: 60, current: 0 }], reward: { coins: 160, reputation: 18, unlockArea: "旧喷泉" }, completed: false },
            4: { chapter: 4, title: "灯会筹备", desc: "筹备第一场属于居民的小镇灯会。", requirements: [{ type: "area", target: 1, current: 0 }, { type: "reputation", target: 90, current: 0 }], reward: { coins: 220, reputation: 24, unlockArea: "庆典会场" }, completed: false },
        };
        return quests[chapter] ?? quests[4];
    }

    shouldRefreshWeeklyGoal(goal: TownGoal | null | undefined, day: number) {
        if (!goal) return true;
        const currentWeek = Math.ceil(day / 7);
        return !goal.id.endsWith(`-${currentWeek}`);
    }

    applyProgress(save: TownSave, worldState: TownWorldState, context: ProgressContext, getBuildingLevel: (worldState: TownWorldState, buildingId: string) => number): ProgressResult {
        const completedTasks: TownTask[] = [];
        let completedWeeklyGoal: TownGoal | null = null;
        worldState.dailyTasks = (worldState.dailyTasks ?? []).map((task) => {
            if (task.completed) return task;
            const progress = this.getTaskProgress(task, context);
            const nextTask = { ...task, progress: Math.min(task.target, task.progress + progress) };
            if (nextTask.progress >= nextTask.target) {
                nextTask.completed = true;
                completedTasks.push(nextTask);
                this.applyRewardToWorldState(save, worldState, nextTask.reward);
            }
            return nextTask;
        });
        if (worldState.weeklyGoal && !worldState.weeklyGoal.completed) {
            const progress = this.getGoalProgress(worldState.weeklyGoal, context, completedTasks.length);
            worldState.weeklyGoal = { ...worldState.weeklyGoal, progress: Math.min(worldState.weeklyGoal.target, worldState.weeklyGoal.progress + progress) };
            if (worldState.weeklyGoal.progress >= worldState.weeklyGoal.target) {
                worldState.weeklyGoal.completed = true;
                completedWeeklyGoal = worldState.weeklyGoal;
                this.applyRewardToWorldState(save, worldState, worldState.weeklyGoal.reward);
            }
        }

        const questCompleted = this.updateMainQuest(save, worldState, getBuildingLevel);
        const achievements = this.applyAchievements(save, worldState);
        return { completedTasks, completedWeeklyGoal, questCompleted, achievements };
    }

    applyRewardToWorldState(save: TownSave, worldState: TownWorldState, reward: { coins?: number; stamina?: number; reputation?: number }) {
        save.coins = Math.max(0, save.coins + (reward.coins ?? 0));
        save.stamina = Math.min(100, Math.max(0, save.stamina + (reward.stamina ?? 0)));
        worldState.reputation = Math.max(0, worldState.reputation + (reward.reputation ?? 0));
    }

    private getTaskProgress(task: TownTask, context: ProgressContext) {
        if (task.type === context.action) return 1;
        if (task.type === "earnCoins") return Math.max(0, context.coinsDelta ?? 0);
        if (task.type === "gainReputation") return Math.max(0, context.reputationDelta ?? 0);
        return 0;
    }

    private getGoalProgress(goal: TownGoal, context: ProgressContext, completedTasks: number) {
        if (goal.type === "completeTasks") return completedTasks;
        if (goal.type === context.action) return 1;
        if (goal.type === "gainReputation") return Math.max(0, context.reputationDelta ?? 0);
        return 0;
    }

    private updateMainQuest(save: TownSave, worldState: TownWorldState, getBuildingLevel: (worldState: TownWorldState, buildingId: string) => number): TownQuestState | null {
        const currentQuest = worldState.mainQuest ?? this.createMainQuest(1);
        const nextQuest = {
            ...currentQuest,
            requirements: currentQuest.requirements.map((requirement) => ({ ...requirement, current: this.getRequirementCurrent(save, worldState, requirement.type, getBuildingLevel) })),
        };
        if (nextQuest.requirements.every((requirement) => requirement.current >= requirement.target)) {
            nextQuest.completed = true;
            this.applyRewardToWorldState(save, worldState, nextQuest.reward);
            if (nextQuest.reward.unlockArea && !worldState.unlockedAreas.includes(nextQuest.reward.unlockArea)) {
                worldState.unlockedAreas = [...worldState.unlockedAreas, nextQuest.reward.unlockArea];
            }
            worldState.mainQuest = this.createMainQuest(nextQuest.chapter + 1);
            return nextQuest;
        }
        worldState.mainQuest = nextQuest;
        return null;
    }

    private getRequirementCurrent(save: TownSave, worldState: TownWorldState, type: string, getBuildingLevel: (worldState: TownWorldState, buildingId: string) => number) {
        if (type === "level") return save.level;
        if (type === "reputation") return worldState.reputation;
        if (type === "coins") return save.coins;
        if (type === "area") return Math.max(0, worldState.unlockedAreas.length - 3);
        if (type.startsWith("building:")) return getBuildingLevel(worldState, type.split(":")[1]);
        return 0;
    }

    private applyAchievements(save: TownSave, worldState: TownWorldState) {
        const achievementRules = [
            { id: "第一桶金", done: save.coins >= 300 },
            { id: "人气初现", done: worldState.reputation >= 50 },
            { id: "建筑师", done: worldState.buildings.some((building) => building.level >= 5) },
            { id: "探索者", done: worldState.unlockedAreas.length >= 5 },
            { id: "庆典小镇", done: worldState.unlockedAreas.includes("庆典会场") },
        ];
        const current = new Set(worldState.achievements ?? []);
        const unlocked: string[] = [];
        for (const rule of achievementRules) {
            if (rule.done && !current.has(rule.id)) {
                current.add(rule.id);
                unlocked.push(rule.id);
            }
        }
        worldState.achievements = [...current];
        return unlocked;
    }
}
