import { Injectable } from "@nestjs/common";

import type { TownSave, TownWorldState } from "../../../db/entities";
import { TOWN_ACHIEVEMENT_CATALOG, createTownDailyTasks, createTownMainQuest, createTownWeeklyGoal } from "../catalog";
import type { TownActionDto } from "../dto";

export type TownTask = NonNullable<TownWorldState["dailyTasks"]>[number];
export type TownGoal = NonNullable<TownWorldState["weeklyGoal"]>;
export type TownQuestState = NonNullable<TownWorldState["mainQuest"]>;
export type ProgressContext = {
    action?: TownActionDto["action"] | "chat";
    coinsDelta?: number;
    reputationDelta?: number;
    completedTasks?: number;
    skipDailyProgress?: boolean;
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
        return createTownDailyTasks(day);
    }

    createWeeklyGoal(day = 1): TownGoal {
        return createTownWeeklyGoal(day);
    }

    createMainQuest(chapter: number): TownQuestState {
        return createTownMainQuest(chapter);
    }

    shouldRefreshWeeklyGoal(goal: TownGoal | null | undefined, day: number) {
        if (!goal) return true;
        const currentWeek = Math.ceil(day / 7);
        return !goal.id.endsWith(`-${currentWeek}`);
    }

    applyProgress(save: TownSave, worldState: TownWorldState, context: ProgressContext, getBuildingLevel: (worldState: TownWorldState, buildingId: string) => number): ProgressResult {
        const completedTasks: TownTask[] = [];
        let completedWeeklyGoal: TownGoal | null = null;
        if (!context.skipDailyProgress) {
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
        }
        if (!context.skipDailyProgress && worldState.weeklyGoal && !worldState.weeklyGoal.completed) {
            const currentProgress = worldState.weeklyGoal.progress;
            const delta = this.getGoalProgress(worldState.weeklyGoal, context, completedTasks.length);
            const nextProgress = Math.min(worldState.weeklyGoal.target, Math.max(currentProgress, currentProgress + delta));
            worldState.weeklyGoal = { ...worldState.weeklyGoal, progress: nextProgress };
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
        // 终态：所有章节已完成，不再发放奖励
        if (currentQuest.completed) {
            return null;
        }
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
        const current = new Set(worldState.achievements ?? []);
        const unlocked: string[] = [];
        for (const rule of TOWN_ACHIEVEMENT_CATALOG) {
            if (this.isAchievementDone(rule, save, worldState) && !current.has(rule.id)) {
                current.add(rule.id);
                unlocked.push(rule.id);
            }
        }
        worldState.achievements = [...current];
        return unlocked;
    }

    private isAchievementDone(rule: (typeof TOWN_ACHIEVEMENT_CATALOG)[number], save: TownSave, worldState: TownWorldState) {
        if (rule.condition === "coins") return save.coins >= (rule.target ?? 0);
        if (rule.condition === "reputation") return worldState.reputation >= (rule.target ?? 0);
        if (rule.condition === "buildingLevel") return worldState.buildings.some((building) => building.level >= (rule.buildingLevel ?? rule.target ?? 0));
        if (rule.condition === "unlockedAreas") return worldState.unlockedAreas.length >= (rule.target ?? 0);
        if (rule.condition === "areaUnlocked") return Boolean(rule.area && worldState.unlockedAreas.includes(rule.area));
        return false;
    }
}
