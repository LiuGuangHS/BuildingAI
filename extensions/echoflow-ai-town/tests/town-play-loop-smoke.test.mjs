import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: "NodeNext",
    moduleResolution: "NodeNext",
});
require("ts-node/register/transpile-only");

const { TownProgressRulesService } = require("../src/api/modules/town/services/town-progress-rules.service.ts");
const { TownWorldRulesService } = require("../src/api/modules/town/services/town-world-rules.service.ts");
const { TOWN_ACTION_CATALOG, resolveTownActionCatalogValue } = require("../src/api/modules/town/catalog/town-actions.catalog.ts");

function createSmokeSave() {
    return {
        id: "smoke-save",
        userId: "smoke-user",
        name: "Smoke Town",
        day: 1,
        level: 1,
        coins: 120,
        stamina: 82,
        mood: "期待",
        worldState: {
            reputation: 12,
            weather: "晴朗",
            focus: "开业准备",
            unlockedAreas: ["暖光餐馆", "中心广场", "花店街角"],
            buildings: [
                { id: "restaurant", name: "暖光餐馆", level: 1, status: "营业中" },
                { id: "florist", name: "街角花店", level: 1, status: "布置中" },
                { id: "square", name: "中心广场", level: 1, status: "开放" },
            ],
            dailyTasks: [],
            weeklyGoal: null,
            mainQuest: null,
            achievements: [],
            activeFestival: null,
            retention: {
                streak: 0,
                lastQualifiedDay: 0,
                todayQualified: false,
                nextHook: {
                    day: 1,
                    title: "开业准备",
                    reason: "完成一次行动后会出现新的小镇目标。",
                    action: "operate",
                    target: "restaurant",
                },
            },
            flags: {
                actionBudget: {
                    day: 1,
                    maxPerDay: 4,
                    usedActions: [],
                },
            },
        },
    };
}

function createResultSnapshot(save) {
    return {
        coins: save.coins,
        stamina: save.stamina,
        reputation: save.worldState.reputation,
        level: save.level,
    };
}

function applyAction(save, action, rules) {
    const before = createResultSnapshot(save);
    const weatherEffect = rules.world.getWeatherEffect(save.worldState.weather);
    const restaurantLevel = rules.world.getBuildingLevel(save.worldState, "restaurant");
    const floristLevel = rules.world.getBuildingLevel(save.worldState, "florist");
    const squareLevel = rules.world.getBuildingLevel(save.worldState, "square");
    const catalogItem = TOWN_ACTION_CATALOG[action];
    assert.ok(catalogItem, `unsupported smoke action ${action}`);
    const catalogContext = {
        restaurantLevel,
        floristLevel,
        squareLevel,
        weather: save.worldState.weather,
        weatherEffect,
        suggestion: "Smoke test strategy",
        mood: save.mood,
    };
    const actionConfig = {
        coins: resolveTownActionCatalogValue(catalogItem.coins ?? 0, catalogContext),
        stamina: resolveTownActionCatalogValue(catalogItem.stamina, catalogContext),
        reputation: resolveTownActionCatalogValue(catalogItem.reputation ?? 0, catalogContext),
    };
    save.coins = Math.max(0, save.coins + actionConfig.coins);
    save.stamina = Math.min(100, Math.max(0, save.stamina + actionConfig.stamina));
    save.worldState.reputation = Math.max(0, save.worldState.reputation + actionConfig.reputation);

    const progress = rules.progress.applyProgress(
        save,
        save.worldState,
        { action, coinsDelta: actionConfig.coins, reputationDelta: actionConfig.reputation },
        (worldState, buildingId) => rules.world.getBuildingLevel(worldState, buildingId),
    );
    const festivalResult = rules.world.advanceFestival(save.worldState, save, action);
    save.worldState = festivalResult.worldState;
    save.worldState.retention = {
        ...save.worldState.retention,
        lastQualifiedDay: save.day,
        todayQualified: true,
        nextHook: {
            day: save.day + 1,
            title: "明日小镇目标",
            reason: `${action} 已让今天成为有效经营日。`,
            action: "operate",
            target: "restaurant",
        },
    };
    save.worldState.flags.actionBudget = {
        ...save.worldState.flags.actionBudget,
        usedActions: [...save.worldState.flags.actionBudget.usedActions, action],
    };

    return {
        action,
        title: {
            operate: "暖光餐馆开张",
            visit: "街角拜访",
            explore: "街区探索",
        }[action],
        before,
        after: createResultSnapshot(save),
        progress,
        festival: festivalResult.event ?? null,
    };
}

function restToNextDay(save, rules) {
    const settlement = rules.world.createDailySettlement(save, save.worldState);
    save.coins = Math.max(0, save.coins + settlement.income - settlement.maintenance);
    save.stamina = Math.min(100, save.stamina + 42);
    save.worldState.reputation = Math.max(0, save.worldState.reputation + settlement.reputation);
    save.day += 1;
    save.worldState = {
        ...save.worldState,
        weather: settlement.weather,
        focus: "新的一天",
        lastSettlement: settlement,
        dailyTasks: rules.progress.createDailyTasks(save.day),
        weeklyGoal: rules.progress.shouldRefreshWeeklyGoal(save.worldState.weeklyGoal, save.day)
            ? rules.progress.createWeeklyGoal(save.day)
            : save.worldState.weeklyGoal,
        flags: {
            ...save.worldState.flags,
            actionBudget: {
                day: save.day,
                maxPerDay: save.worldState.flags.actionBudget.maxPerDay,
                usedActions: [],
            },
        },
        retention: {
            ...save.worldState.retention,
            streak: save.worldState.retention.todayQualified ? save.worldState.retention.streak + 1 : 0,
            todayQualified: false,
            nextHook: {
                day: save.day,
                title: "明日小镇目标",
                reason: "日结后公告板出现了新的目标。",
                action: "operate",
                target: "restaurant",
            },
        },
    };
    return settlement;
}

test("five-minute town loop smoke advances save action event settlement and next-day goals", () => {
    const rules = {
        progress: new TownProgressRulesService(),
        world: new TownWorldRulesService(),
    };
    const save = createSmokeSave();

    save.worldState.dailyTasks = rules.progress.createDailyTasks(save.day);
    save.worldState.weeklyGoal = rules.progress.createWeeklyGoal(save.day);
    save.worldState.mainQuest = rules.progress.createMainQuest(1);

    const actions = [
        applyAction(save, "operate", rules),
        applyAction(save, "visit", rules),
        applyAction(save, "explore", rules),
    ];
    const settlement = restToNextDay(save, rules);

    assert.equal(save.day, 2);
    assert.equal(actions.length, 3);
    assert.deepEqual(actions.map((event) => event.action), ["operate", "visit", "explore"]);
    assert.deepEqual(actions.map((event) => event.title), ["暖光餐馆开张", "街角拜访", "街区探索"]);
    assert.ok(actions[0].after.coins > actions[0].before.coins, "operate should earn coins");
    assert.ok(actions[1].after.reputation > actions[1].before.reputation, "visit should raise reputation");
    assert.ok(actions[2].after.stamina < actions[2].before.stamina, "explore should spend stamina");
    assert.ok(actions.some((event) => event.progress.completedTasks.length > 0), "at least one daily task should complete");
    assert.equal(actions.some((event) => event.festival), false, "opening-day loop should not require a festival unlock");
    assert.equal(save.worldState.flags.actionBudget.day, 2);
    assert.deepEqual(save.worldState.flags.actionBudget.usedActions, []);
    assert.equal(save.worldState.retention.streak, 1);
    assert.equal(save.worldState.retention.todayQualified, false);
    assert.equal(save.worldState.dailyTasks.every((task) => task.id.endsWith("-2")), true);
    assert.equal(save.worldState.weeklyGoal.id, "weekly-tasks-1");
    assert.equal(settlement.day, 2);
    assert.ok(save.worldState.lastSettlement.summary.includes("第 2 天"));
    assert.equal(save.worldState.weather, settlement.weather);
    assert.equal(typeof settlement.weather, "string");
    assert.ok(settlement.breakdown.some((item) => item.label === "建筑维护"));
});
