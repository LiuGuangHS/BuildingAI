import type { TownBuilding, TownCharacter, TownEvent, TownFestivalState, TownSave } from "../services/types";

export const townActions = [
    { id: "operate", title: "经营", desc: "餐馆开张", hint: "-体力 / +金币", icon: "店" },
    { id: "visit", title: "拜访", desc: "居民关系", hint: "-体力 / +关系", icon: "友" },
    { id: "decorate", title: "布置", desc: "提升声望", hint: "-金币 / +声望", icon: "花" },
    { id: "explore", title: "探索", desc: "随机事件", hint: "-体力 / +事件", icon: "探" },
    { id: "rest", title: "休息", desc: "进入明天", hint: "+体力 / 日结", icon: "月" },
];

export function formatRequirement(type: string) {
    if (type === "level") return "小镇等级";
    if (type === "reputation") return "声望";
    if (type === "coins") return "金币";
    if (type === "area") return "新区";
    if (type === "building:restaurant") return "餐馆等级";
    if (type === "building:florist") return "花店等级";
    if (type === "building:square") return "广场等级";
    return type;
}

export function resolveEventScene(eventType?: string): "town" | "kitchen" | "npc" | "night" {
    if (eventType === "operate" || eventType === "upgrade") return "kitchen";
    if (eventType === "visit" || eventType === "chat" || eventType === "relationship" || eventType === "npc_story") return "npc";
    if (eventType === "explore" || eventType === "unlock" || eventType === "festival") return "night";
    return "town";
}

export function resolveActionModal(action?: string, eventType?: string) {
    if (action === "rest") return "settlement";
    if (action === "advice") return "advice";
    if (action === "upgrade") return "building";
    if (eventType === "task" || eventType === "quest" || eventType === "achievement") return "tasks";
    if (action === "explore" || eventType === "unlock") return "event";
    if (action === "visit") return "npc";
    if (action === "operate" || action === "decorate") return "event";
    return null;
}

export function findPrimaryEvent(events: TownEvent[], action?: string) {
    if (!action) return events[0];
    const preferredTypes = action === "advice" ? ["advice"] : action === "rest" ? ["rest"] : action === "upgrade" ? ["upgrade"] : [action];
    return events.find((event) => preferredTypes.includes(event.type)) ?? events[0];
}

export function groupEvents(events: TownEvent[]) {
    const groups = [
        { title: "今日事件", match: (event: TownEvent) => ["operate", "visit", "decorate", "explore", "rest", "upgrade"].includes(event.type), events: [] as TownEvent[] },
        { title: "目标推进", match: (event: TownEvent) => ["task", "weekly", "quest", "achievement", "unlock"].includes(event.type), events: [] as TownEvent[] },
        { title: "居民与 AI", match: (event: TownEvent) => ["chat", "advice", "relationship", "npc_story"].includes(event.type), events: [] as TownEvent[] },
        { title: "小镇活动", match: (event: TownEvent) => ["festival"].includes(event.type), events: [] as TownEvent[] },
        { title: "小镇记录", match: () => true, events: [] as TownEvent[] },
    ];
    for (const event of events) {
        const group = groups.find((item) => item.match(event));
        group?.events.push(event);
    }
    return groups.filter((group) => group.events.length);
}

export function formatEventType(type: string) {
    const labels: Record<string, string> = {
        system: "小镇记录",
        operate: "经营事件",
        visit: "拜访事件",
        decorate: "布置事件",
        explore: "探索事件",
        rest: "日结事件",
        upgrade: "建筑升级",
        chat: "居民对话",
        advice: "AI 建议",
        unlock: "区域解锁",
        task: "任务完成",
        weekly: "周目标",
        quest: "主线推进",
        achievement: "成就达成",
        relationship: "关系升温",
        npc_story: "居民支线",
        festival: "小镇活动",
    };
    return labels[type] ?? type;
}

export function isAiEventType(type: string) {
    return type === "advice" || type === "explore" || type === "chat";
}

export function getRelationshipLevel(value: number) {
    if (value >= 80) return "羁绊";
    if (value >= 60) return "信赖";
    if (value >= 40) return "朋友";
    if (value >= 20) return "熟悉";
    return "陌生";
}

export function getRelationshipBenefit(character: TownCharacter) {
    const tier = character.relationship >= 80 ? 3 : character.relationship >= 60 ? 2 : character.relationship >= 40 ? 1 : 0;
    if (character.name === "小满") return tier ? `经营餐馆额外 +${tier === 3 ? 14 : tier === 2 ? 9 : 5} 金币` : "朋友关系后解锁帮厨收益";
    if (character.name === "阿泽") return tier ? `升级建筑费用 -${tier === 3 ? 20 : tier === 2 ? 14 : 8} 金币` : "朋友关系后解锁升级折扣";
    if (character.name === "花音") return tier ? `布置小镇额外 +${tier === 3 ? 5 : tier === 2 ? 3 : 2} 声望` : "朋友关系后解锁花艺收益";
    if (character.name === "旅人洛") return tier ? `探索街区返还 ${tier === 3 ? 5 : tier === 2 ? 3 : 2} 体力` : "朋友关系后解锁探索向导";
    return "提升关系可解锁小镇收益";
}

export function formatFestivalAction(action: TownFestivalState["action"]) {
    const labels: Record<TownFestivalState["action"], string> = { operate: "经营餐馆", visit: "拜访居民", decorate: "布置小镇", explore: "探索街区", upgrade: "升级建筑" };
    return labels[action];
}

export function formatFestivalStatus(status: TownFestivalState["status"]) {
    const labels: Record<TownFestivalState["status"], string> = { announced: "预告中", preparing: "筹备中", ready: "待收尾", completed: "已完成" };
    return labels[status];
}

export function getUpgradeCost(level: number) {
    return 60 + level * 35;
}

export function getBuildingStatus(save: TownSave, building: TownBuilding) {
    if (building.level >= (building.maxLevel ?? 5)) return "满级";
    return save.coins >= getUpgradeCost(building.level) ? "可升级" : building.status;
}

export function isBuildingUpgradeable(save: TownSave, building: TownBuilding) {
    return building.level < (building.maxLevel ?? 5) && save.coins >= getUpgradeCost(building.level);
}

export function getBuildingActionCopy(buildingId: string) {
    if (buildingId === "restaurant") {
        return { primary: "经营餐馆", secondary: "", upgrade: "升级餐馆", tip: "经营餐馆会消耗体力换取金币，升级后经营收入和日结收益都会提高。" };
    }
    if (buildingId === "florist") {
        return { primary: "拜访花店", secondary: "布置街角", upgrade: "升级花店", tip: "花店适合提升居民关系和小镇声望，布置街角会消耗金币。" };
    }
    return { primary: "探索广场", secondary: "举办活动", upgrade: "升级广场", tip: "广场会带来随机事件和区域线索，升级后探索回报更稳定。" };
}

export function getRecommendedTarget(save: TownSave | null) {
    if (!save) return null;
    if (save.stamina < 30) return "rest";
    if (save.coins < 80) return "restaurant";
    if (save.worldState.weather === "小雨") return save.characters.find((character) => character.role.includes("花店"))?.id ?? "florist";
    if ((save.worldState.dailyTasks ?? []).some((task) => !task.completed && task.type === "explore")) return "square";
    return "florist";
}

export function getRecommendedAction(save: TownSave | null, recommendedTarget: string | null) {
    if (!save) return null;
    const task = save.worldState.dailyTasks?.find((item) => !item.completed);
    if (task) {
        if (["operate", "visit", "decorate", "explore", "upgrade", "chat"].includes(task.type)) return task.type === "chat" ? "visit" : task.type;
        if (task.type === "earnCoins") return "operate";
        if (task.type === "gainReputation") return "visit";
    }
    if (recommendedTarget === "restaurant") return "operate";
    if (recommendedTarget === "florist") return "visit";
    if (recommendedTarget === "square") return "explore";
    if (recommendedTarget === "rest") return "rest";
    if (save.characters.some((character) => character.id === recommendedTarget)) return "visit";
    return null;
}

export function getStrategyPlan(save: TownSave) {
    const target = getRecommendedTarget(save);
    const action = getRecommendedAction(save, target);
    const targetCharacter = save.characters.find((character) => character.id === target);
    const targetBuilding = save.worldState.buildings.find((building) => building.id === target);
    const labels: Record<string, string> = { operate: "经营餐馆", visit: "拜访居民", decorate: "布置小镇", explore: "探索街区", rest: "休息一天", upgrade: "升级建筑" };
    const risk = getStrategyRisk(save);
    return {
        actionLabel: action ? labels[action] ?? action : "自由经营",
        reason: getStrategyReason(save, action),
        targetLabel: targetCharacter?.name ?? targetBuilding?.name ?? (target === "rest" ? "休息日程" : "小镇地图"),
        targetHint: targetCharacter ? `${targetCharacter.name}当前是${getRelationshipLevel(targetCharacter.relationship)}关系，适合继续培养。` : targetBuilding ? `${targetBuilding.name} Lv.${targetBuilding.level}，${getBuildingStatus(save, targetBuilding)}。` : "根据今日状态灵活选择下一步。",
        riskLabel: risk.label,
        riskHint: risk.hint,
    };
}

function getStrategyReason(save: TownSave, action: string | null) {
    const task = save.worldState.dailyTasks?.find((item) => !item.completed);
    if (task) return `优先完成今日任务“${task.title}”，可以稳定获得奖励。`;
    if (action === "operate") return "金币偏低或餐馆收益较高，先保证现金流最稳。";
    if (action === "visit") return "当前天气和居民状态适合社交，可以推进关系与声望。";
    if (action === "explore") return "探索能发现新线索，也更容易推动区域解锁。";
    if (action === "rest") return "体力偏低，休息能推进日期并恢复行动空间。";
    return "资源状态平稳，可以围绕主线或建筑升级自由安排。";
}

function getStrategyRisk(save: TownSave) {
    if (save.stamina < 30) return { label: "体力偏低", hint: "继续高消耗行动前，建议先休息或选择轻量拜访。" };
    if (save.coins < 60) return { label: "金币紧张", hint: "升级和布置会受限，优先经营餐馆更安全。" };
    if ((save.worldState.dailyTasks ?? []).some((task) => !task.completed)) return { label: "任务未完成", hint: "今日任务还没清完，先跟着目标走收益更稳定。" };
    return { label: "状态良好", hint: "当前资源足够，可以尝试探索或推进建筑升级。" };
}

export function getActionTask(save: TownSave, action: string) {
    return (save.worldState.dailyTasks ?? []).find((task) => {
        if (task.completed) return false;
        if (task.type === action) return true;
        if (task.type === "chat" && action === "visit") return true;
        if (task.type === "earnCoins" && action === "operate") return true;
        if (task.type === "gainReputation" && (action === "visit" || action === "decorate")) return true;
        return false;
    }) ?? null;
}

export function getChoiceTone(choiceId: string) {
    if (choiceId === "operate") return "safe";
    if (choiceId === "visit") return "social";
    if (choiceId === "explore") return "bold";
    if (choiceId === "rest") return "rest";
    return "safe";
}

export function getChoicePreview(save: TownSave, choiceId: string) {
    const cost = getActionCost(save, choiceId);
    const items: string[] = [];
    if (cost.stamina) items.push(`体力 ${cost.stamina}`);
    if (cost.coins) items.push(`金币 ${cost.coins}`);
    if (choiceId === "operate") items.push("金币 +");
    if (choiceId === "visit") items.push("关系 +");
    if (choiceId === "explore") items.push("线索 +");
    if (choiceId === "rest") items.push("明天 +1");
    return items;
}

export function getResultSummary(event: TownEvent) {
    const result = event.result;
    if (!result) return "小镇状态已记录。";
    const gains = [
        typeof result.coins === "number" && result.coins !== 0 ? `金币 ${result.coins > 0 ? "+" : ""}${result.coins}` : null,
        typeof result.stamina === "number" && result.stamina !== 0 ? `体力 ${result.stamina > 0 ? "+" : ""}${result.stamina}` : null,
        typeof result.reputation === "number" && result.reputation !== 0 ? `声望 ${result.reputation > 0 ? "+" : ""}${result.reputation}` : null,
        result.relationship ? `关系 +${Object.values(result.relationship)[0]}` : null,
        result.bonuses?.length ? `关系收益：${result.bonuses.join("、")}` : null,
    ].filter(Boolean);
    return gains.length ? gains.join("，") : "这次行动推进了小镇故事。";
}

export function getNextReputationTarget(save: TownSave) {
    return Math.max(save.level * 18, save.worldState.reputation || 1);
}

export function getNextUnlockGoal(save: TownSave) {
    const worldState = save.worldState;
    const restaurant = worldState.buildings.find((building) => building.id === "restaurant")?.level ?? 1;
    const florist = worldState.buildings.find((building) => building.id === "florist")?.level ?? 1;
    const square = worldState.buildings.find((building) => building.id === "square")?.level ?? 1;
    const candidates = [
        { title: "夜市街角", desc: "提高声望，开放夜晚经营传闻。", label: "声望", progress: worldState.reputation, target: 30, done: worldState.unlockedAreas.includes("夜市街角") },
        { title: "二层露台", desc: "升级餐馆，扩大暖光餐馆空间。", label: "餐馆等级", progress: restaurant, target: 3, done: worldState.unlockedAreas.includes("二层露台") },
        { title: "温室小径", desc: "升级花店，解锁更多居民邀约。", label: "花店等级", progress: florist, target: 3, done: worldState.unlockedAreas.includes("温室小径") },
        { title: "旧喷泉", desc: "升级广场，发现街区旧传闻。", label: "广场等级", progress: square, target: 3, done: worldState.unlockedAreas.includes("旧喷泉") },
        { title: "庆典会场", desc: "声望和地标建筑达标后开放。", label: "声望", progress: worldState.reputation, target: 80, done: worldState.unlockedAreas.includes("庆典会场") },
    ];
    return candidates.find((item) => !item.done) ?? { title: "小镇扩建完成", desc: "继续完成任务，筹备下一场庆典。", label: "声望", progress: worldState.reputation, target: Math.max(100, worldState.reputation) };
}

export function createCompanionMessage(save: TownSave) {
    const task = save.worldState.dailyTasks?.find((item) => !item.completed);
    if (save.stamina < 30) return "体力偏低，适合休息或轻量拜访。";
    if (save.worldState.weather === "小雨") return "今天小雨，居民更愿意聊天。";
    if (task) return `今日可先完成：${task.title}`;
    return save.suggestion.replace(/^AI 建议：/, "");
}

export function getActionAffordability(save: TownSave, action: string, buildingId?: string): { canRun: boolean; reason: string } {
    const costs = getActionCost(save, action, buildingId);
    if (costs.stamina < 0 && save.stamina + costs.stamina < 0) {
        return { canRun: false, reason: "体力不足，先休息一天" };
    }
    if (costs.coins < 0 && save.coins + costs.coins < 0) {
        return { canRun: false, reason: "金币不足，先经营餐馆" };
    }
    return { canRun: true, reason: "" };
}

function getActionCost(save: TownSave, action: string, buildingId?: string): { stamina: number; coins: number } {
    if (action === "advice" || action === "rest" || action === "chat") return { stamina: 0, coins: 0 };
    if (action === "operate") return { stamina: -18, coins: 0 };
    if (action === "visit") return { stamina: -10, coins: -6 };
    if (action === "decorate") return { stamina: -14, coins: -24 };
    if (action === "explore") return { stamina: -16 - getWeatherExploreStaminaCost(save.worldState.weather), coins: 0 };
    if (action === "upgrade") {
        const building = save.worldState.buildings.find((item) => item.id === buildingId);
        return { stamina: -12, coins: building ? -getUpgradeCost(building.level) : 0 };
    }
    return { stamina: 0, coins: 0 };
}

function getWeatherExploreStaminaCost(weather?: string) {
    if (weather === "小雨") return 3;
    if (weather === "大风") return 4;
    return 0;
}
