import { Injectable } from "@nestjs/common";

import type { TownSave, TownWorldState } from "../../../db/entities";
import { TOWN_FESTIVAL_CATALOG, TOWN_WEATHER_CATALOG, DEFAULT_WEATHER_EFFECT, createTownFestivalState, type TownFestivalTemplate } from "../catalog";

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
        return TOWN_WEATHER_CATALOG[weather] ?? DEFAULT_WEATHER_EFFECT;
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
            breakdown: [
                { label: "餐馆收入", value: restaurantLevel * 22, detail: `暖光餐馆 Lv.${restaurantLevel}` },
                { label: "花店收入", value: floristLevel * 8, detail: `街角花店 Lv.${floristLevel}` },
                { label: "建筑维护", value: -maintenance, detail: `${worldState.buildings.length} 个建筑日常维护` },
                { label: "广场声望", value: reputation, detail: `中心广场 Lv.${squareLevel}` },
            ],
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
        let current = worldState.activeFestival;
        if (current && current.status === "ready" && current.daysLeft <= 0) {
            current = { ...current, progress: current.target, status: "completed" };
        }
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
        const candidate = TOWN_FESTIVAL_CATALOG.find((item) => !completedFestivals.includes(item.key) && this.isFestivalUnlocked(item, worldState, save));
        return candidate ? createTownFestivalState(candidate) : null;
    }

    private isFestivalUnlocked(template: TownFestivalTemplate, worldState: TownWorldState, save: TownSave) {
        const { unlock } = template;
        if (unlock.day && save.day < unlock.day) return false;
        if (unlock.reputation && worldState.reputation < unlock.reputation) return false;
        if (unlock.building && this.getBuildingLevel(worldState, unlock.building) < (unlock.buildingLevel ?? 1)) return false;
        return true;
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
