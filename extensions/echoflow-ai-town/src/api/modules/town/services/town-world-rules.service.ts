import { Injectable } from "@nestjs/common";

import type { TownSave, TownWorldState } from "../../../db/entities";

type TownSettlement = NonNullable<TownWorldState["lastSettlement"]>;
export type TownFestivalState = NonNullable<TownWorldState["activeFestival"]>;
export type TownFestivalResult = {
    worldState: TownWorldState;
    event?: TownFestivalState;
    completed?: TownFestivalState;
};

@Injectable()
export class TownWorldRulesService {
    getBuildingLevel(worldState: TownWorldState, buildingId: string) {
        return worldState.buildings.find((building) => building.id === buildingId)?.level ?? 1;
    }

    getWeatherEffect(weather: string) {
        const effects: Record<string, { operateCoins: number; visitReputation: number; exploreReputation: number; exploreStaminaCost: number; reputationMultiplier: number }> = {
            晴朗: { operateCoins: 1.1, visitReputation: 0, exploreReputation: 0, exploreStaminaCost: 0, reputationMultiplier: 1 },
            小雨: { operateCoins: 0.95, visitReputation: 1, exploreReputation: 0, exploreStaminaCost: 0, reputationMultiplier: 1 },
            微风: { operateCoins: 1, visitReputation: 0, exploreReputation: 1, exploreStaminaCost: 0, reputationMultiplier: 1 },
            夜雾: { operateCoins: 1, visitReputation: 0, exploreReputation: 2, exploreStaminaCost: 2, reputationMultiplier: 1 },
            节庆日: { operateCoins: 1.05, visitReputation: 1, exploreReputation: 1, exploreStaminaCost: 0, reputationMultiplier: 1.2 },
        };
        return effects[weather] ?? effects.晴朗;
    }

    createDailySettlement(save: TownSave, worldState: TownWorldState): TownSettlement {
        const restaurantLevel = this.getBuildingLevel(worldState, "restaurant");
        const floristLevel = this.getBuildingLevel(worldState, "florist");
        const squareLevel = this.getBuildingLevel(worldState, "square");
        const weather = this.pickNextWeather(save.day + worldState.reputation + restaurantLevel + floristLevel + squareLevel);
        const income = restaurantLevel * 22 + floristLevel * 8;
        const maintenance = worldState.buildings.reduce((total, building) => total + building.level * 4, 0);
        const reputation = squareLevel * 2;
        return {
            day: save.day + 1,
            weather,
            income,
            maintenance,
            reputation,
            summary: `小镇迎来了第 ${save.day + 1} 天。建筑带来 ${income} 金币收入，维护花费 ${maintenance} 金币，广场让声望提升 ${reputation}。今天的天气是${weather}。`,
        };
    }

    applyAreaUnlocks(worldState: TownWorldState) {
        const rules = [
            { area: "夜市街角", unlocked: worldState.reputation >= 30 },
            { area: "二层露台", unlocked: this.getBuildingLevel(worldState, "restaurant") >= 3 },
            { area: "温室小径", unlocked: this.getBuildingLevel(worldState, "florist") >= 3 },
            { area: "旧喷泉", unlocked: this.getBuildingLevel(worldState, "square") >= 3 },
            { area: "庆典会场", unlocked: worldState.reputation >= 80 && worldState.buildings.some((building) => building.level >= 5) },
        ];
        const nextAreas = [...worldState.unlockedAreas];
        const unlockedAreas: string[] = [];
        for (const rule of rules) {
            if (rule.unlocked && !nextAreas.includes(rule.area)) {
                nextAreas.push(rule.area);
                unlockedAreas.push(rule.area);
            }
        }
        return { worldState: { ...worldState, unlockedAreas: nextAreas }, unlockedAreas };
    }

    upgradeBuilding(worldState: TownWorldState, buildingId: string): TownWorldState {
        return {
            ...worldState,
            buildings: worldState.buildings.map((building) => {
                if (building.id !== buildingId) return building;
                const nextLevel = building.level + 1;
                return {
                    ...building,
                    level: nextLevel,
                    status: nextLevel >= 3 ? "小镇地标" : "升级完成",
                };
            }),
        };
    }

    getBuildingUpgradeCost(level: number) {
        return 60 + level * 35;
    }

    advanceFestival(worldState: TownWorldState, save: TownSave, action: string): TownFestivalResult {
        const current = worldState.activeFestival;
        const nextFestival = current ? this.advanceExistingFestival(current, action) : this.createFestivalCandidate(worldState, save);
        if (!nextFestival) return { worldState: { ...worldState, activeFestival: null } };

        const completed = nextFestival.status === "completed" ? nextFestival : undefined;
        const nextWorldState = this.applyFestivalCompletion({ ...worldState, activeFestival: completed ? null : nextFestival }, completed);
        return { worldState: nextWorldState, event: nextFestival, completed };
    }

    private advanceExistingFestival(festival: TownFestivalState, action: string): TownFestivalState {
        const matchedAction = action === festival.action;
        const progress = Math.min(festival.target, festival.progress + (matchedAction ? 1 : 0));
        const daysLeft = Math.max(0, festival.daysLeft - 1);
        const status = progress >= festival.target ? "completed" : daysLeft <= 0 ? "ready" : progress > festival.progress ? "preparing" : festival.status;
        return { ...festival, progress, daysLeft, status };
    }

    private createFestivalCandidate(worldState: TownWorldState, save: TownSave): TownFestivalState | null {
        const completed = worldState.flags?.completedFestivals;
        const completedFestivals = Array.isArray(completed) ? completed : [];
        const candidates: TownFestivalState[] = [
            {
                key: "festival-lantern",
                title: "暖光灯会",
                desc: "居民正在筹备夜晚灯会，继续拜访居民可以收集愿望纸条。",
                status: "announced",
                progress: 0,
                target: 2,
                daysLeft: 3,
                action: "visit",
                reward: { coins: 48, reputation: 10 },
            },
            {
                key: "restaurant-new-menu",
                title: "餐馆新品日",
                desc: "小满想试做一份新品套餐，连续经营餐馆可以完成试吃会。",
                status: "announced",
                progress: 0,
                target: 2,
                daysLeft: 3,
                action: "operate",
                reward: { coins: 72, reputation: 5 },
            },
            {
                key: "florist-show",
                title: "花店街角展",
                desc: "花音准备把街角布置成花展，继续布置小镇可以完成展台。",
                status: "announced",
                progress: 0,
                target: 2,
                daysLeft: 3,
                action: "decorate",
                reward: { coins: 36, reputation: 12 },
            },
            {
                key: "fountain-repair",
                title: "旧喷泉修复日",
                desc: "旧喷泉传来新的水声，继续探索广场可以找到修复线索。",
                status: "announced",
                progress: 0,
                target: 2,
                daysLeft: 3,
                action: "explore",
                reward: { coins: 40, reputation: 8, unlockArea: "喷泉夜话" },
            },
        ];
        return candidates.find((candidate) => !completedFestivals.includes(candidate.key) && this.isFestivalUnlocked(candidate.key, worldState, save)) ?? null;
    }

    private isFestivalUnlocked(key: string, worldState: TownWorldState, save: TownSave) {
        if (key === "festival-lantern") return save.day >= 5 && worldState.reputation >= 45;
        if (key === "restaurant-new-menu") return this.getBuildingLevel(worldState, "restaurant") >= 3;
        if (key === "florist-show") return this.getBuildingLevel(worldState, "florist") >= 3;
        if (key === "fountain-repair") return this.getBuildingLevel(worldState, "square") >= 3;
        return false;
    }

    private applyFestivalCompletion(worldState: TownWorldState, festival?: TownFestivalState): TownWorldState {
        if (!festival) return worldState;
        const completed = worldState.flags?.completedFestivals;
        const completedFestivals = Array.isArray(completed) ? completed : [];
        const unlockedAreas = festival.reward.unlockArea && !worldState.unlockedAreas.includes(festival.reward.unlockArea)
            ? [...worldState.unlockedAreas, festival.reward.unlockArea]
            : worldState.unlockedAreas;
        return {
            ...worldState,
            reputation: Math.max(0, worldState.reputation + (festival.reward.reputation ?? 0)),
            unlockedAreas,
            flags: {
                ...(worldState.flags ?? {}),
                completedFestivals: [...completedFestivals, festival.key],
            },
        };
    }

    private pickNextWeather(seed: number) {
        const options = ["晴朗", "小雨", "微风", "夜雾", "节庆日"];
        return options[Math.abs(seed) % options.length];
    }
}
