import type { TownBuilding, TownCharacter, TownEvent, TownRetentionState, TownSave } from "../services/types";
import {
    createCompanionMessage,
    formatEventType,
    getActionAffordability,
    getActionTask,
    getBuildingStatus,
    getChoicePreview,
    getMemoryPromiseCount,
    getNextReputationTarget,
    getNextUnlockGoal,
    getRecommendedAction,
    getRecommendedTarget,
    getRelationshipLevel,
    isBuildingUpgradeable,
    resolveEventScene,
    townActions,
} from "./game-rules";

export type TownSceneKind = "town" | "kitchen" | "npc" | "night";

export type TownHudViewModel = {
    day: number;
    name: string;
    weather: string;
    coins: number;
    stamina: number;
    mood: string;
    reputation: {
        value: number;
        target: number;
    };
};

export type TownBuildingHotspotViewModel = {
    id: string;
    name: string;
    level: number;
    status: string;
    effect?: string;
    recommended: boolean;
    upgradeable: boolean;
    primaryAction: "operate" | "visit" | "explore";
    disabledReason: string;
    building: TownBuilding;
};

export type TownCharacterHotspotViewModel = {
    id: string;
    name: string;
    role: string;
    status: string;
    relationship: number;
    relationshipLevel: string;
    memorySummary: string;
    pendingPromiseCount: number;
    pendingPromise?: string;
    recommended: boolean;
    character: TownCharacter;
};

export type TownCommandViewModel = {
    id: string;
    title: string;
    desc: string;
    hint: string;
    icon: string;
    canRun: boolean;
    disabledReason: string;
    recommended: boolean;
    taskLinked: boolean;
    preview: string[];
};

export type TownActionStateViewModel = {
    id: string;
    canRun: boolean;
    disabledReason: string;
    taskLinked: boolean;
    preview: string[];
};

export type TownGoalViewModel = {
    primary: {
        title: string;
        desc: string;
        progress: number;
        target: number;
        label: string;
    };
    dailyOpen: number;
    dailyTotal: number;
    nextTaskTitle: string;
    companionMessage: string;
    actionBudget: TownActionBudgetViewModel;
    memoryPromiseCount: number;
    retention: TownRetentionViewModel;
};

export type TownRetentionViewModel = {
    streak: number;
    todayQualified: boolean;
    label: string;
    nextHook: TownRetentionState["nextHook"];
};

export type TownActionBudgetViewModel = {
    day: number;
    maxPerDay: number;
    used: number;
    remaining: number;
    usedActions: string[];
    label: string;
};

export type TownEventSummaryViewModel = {
    id: string;
    type: string;
    label: string;
    title: string;
    content: string;
    hasChoices: boolean;
    createdAt: string;
    event: TownEvent;
};

export type TownViewModel = {
    hud: TownHudViewModel;
    scene: TownSceneKind;
    recommendedTarget: string | null;
    recommendedAction: string | null;
    buildings: TownBuildingHotspotViewModel[];
    characters: TownCharacterHotspotViewModel[];
    commands: TownCommandViewModel[];
    goal: TownGoalViewModel;
    latestEvent: TownEvent | null;
    events: TownEventSummaryViewModel[];
};

export function createTownViewModel(save: TownSave, latestEvent: TownEvent | null = save.events[0] ?? null): TownViewModel {
    const recommendedTarget = getRecommendedTarget(save);
    const recommendedAction = getRecommendedAction(save, recommendedTarget);

    return {
        hud: createHudViewModel(save),
        scene: resolveEventScene(latestEvent?.type),
        recommendedTarget,
        recommendedAction,
        buildings: getBuildingHotspots(save, recommendedTarget),
        characters: getCharacterHotspots(save, recommendedTarget),
        commands: getCommandBarState(save, recommendedAction),
        goal: createGoalViewModel(save),
        latestEvent,
        events: save.events.map(createEventSummary),
    };
}

export function createHudViewModel(save: TownSave): TownHudViewModel {
    return {
        day: save.day,
        name: save.name,
        weather: save.worldState.weather,
        coins: save.coins,
        stamina: save.stamina,
        mood: save.mood,
        reputation: {
            value: save.worldState.reputation,
            target: getNextReputationTarget(save),
        },
    };
}

export function getBuildingHotspots(save: TownSave, recommendedTarget = getRecommendedTarget(save)): TownBuildingHotspotViewModel[] {
    return save.worldState.buildings.map((building) => {
        const primaryAction = getPrimaryBuildingAction(building.id);
        const affordability = getActionAffordability(save, primaryAction);
        return {
            id: building.id,
            name: building.name,
            level: building.level,
            status: getBuildingStatus(save, building),
            effect: building.effect,
            recommended: recommendedTarget === building.id,
            upgradeable: isBuildingUpgradeable(save, building),
            primaryAction,
            disabledReason: affordability.reason,
            building,
        };
    });
}

export function getCharacterHotspots(save: TownSave, recommendedTarget = getRecommendedTarget(save)): TownCharacterHotspotViewModel[] {
    return save.characters.map((character) => {
        const promises = character.memory?.promises ?? [];
        return {
            id: character.id,
            name: character.name,
            role: character.role,
            status: character.status,
            relationship: character.relationship,
            relationshipLevel: character.memory?.relationshipLevel ?? getRelationshipLevel(character.relationship),
            memorySummary: character.memory?.summary ?? "还没有形成新的聊天记忆。",
            pendingPromiseCount: promises.length,
            pendingPromise: promises[0],
            recommended: recommendedTarget === character.id,
            character,
        };
    });
}

export function getCommandBarState(save: TownSave, recommendedAction = getRecommendedAction(save, getRecommendedTarget(save))): TownCommandViewModel[] {
    return townActions.map((action) => {
        const actionState = getActionState(save, action.id);
        return {
            ...action,
            canRun: actionState.canRun,
            disabledReason: actionState.disabledReason,
            recommended: recommendedAction === action.id,
            taskLinked: actionState.taskLinked,
            preview: actionState.preview,
        };
    });
}

export function getActionState(save: TownSave, action: string, buildingId?: string): TownActionStateViewModel {
    const budget = getActionBudget(save);
    const preview = getChoicePreview(save, action, buildingId);
    const taskLinked = Boolean(getActionTask(save, action));
    if (isBudgetedAction(action)) {
        if (budget.usedActions.includes(action)) {
            return {
                id: action,
                canRun: false,
                disabledReason: "今天已做过，换个行动或休息到明天",
                taskLinked,
                preview,
            };
        }
        if (budget.remaining <= 0) {
            return {
                id: action,
                canRun: false,
                disabledReason: "今日行动已用完，先休息到明天",
                taskLinked,
                preview,
            };
        }
    }
    const affordability = getActionAffordability(save, action, buildingId);
    return {
        id: action,
        canRun: affordability.canRun,
        disabledReason: affordability.reason,
        taskLinked,
        preview,
    };
}

export function createGoalViewModel(save: TownSave): TownGoalViewModel {
    const nextUnlock = getNextUnlockGoal(save);
    const dailyTasks = save.worldState.dailyTasks ?? [];
    const openTasks = dailyTasks.filter((task) => !task.completed);
    return {
        primary: {
            title: nextUnlock.title,
            desc: nextUnlock.desc,
            progress: nextUnlock.progress,
            target: nextUnlock.target,
            label: nextUnlock.label,
        },
        dailyOpen: openTasks.length,
        dailyTotal: dailyTasks.length,
        nextTaskTitle: openTasks[0]?.title ?? "今日目标已完成",
        companionMessage: createCompanionMessage(save),
        actionBudget: getActionBudget(save),
        memoryPromiseCount: getMemoryPromiseCount(save),
        retention: createRetentionViewModel(save),
    };
}

export function createRetentionViewModel(save: TownSave): TownRetentionViewModel {
    const retention = save.worldState.retention;
    const nextHook = retention?.nextHook ?? {
        day: save.day,
        title: "今日开张计划",
        desc: "先完成一项经营或拜访，让小镇形成可延续的日程。",
        action: "operate" as const,
        target: "restaurant",
        targetLabel: "暖光餐馆",
        reason: "稳定经营是后续关系、章节和活动的基础。",
    };
    const streak = Math.max(0, retention?.streak ?? 0);
    return {
        streak,
        todayQualified: Boolean(retention?.todayQualified),
        label: streak ? `${streak} 天` : "未开始",
        nextHook,
    };
}

export function getActionBudget(save: TownSave): TownActionBudgetViewModel {
    const raw = save.worldState.flags?.actionBudget;
    const source = raw && typeof raw === "object" ? raw as { day?: unknown; maxPerDay?: unknown; usedActions?: unknown } : {};
    const maxPerDay = typeof source.maxPerDay === "number" && source.maxPerDay > 0 ? source.maxPerDay : 4;
    const usedActions = source.day === save.day && Array.isArray(source.usedActions)
        ? [...new Set(source.usedActions.filter((item): item is string => typeof item === "string"))]
        : [];
    const used = Math.min(maxPerDay, usedActions.length);
    const remaining = Math.max(0, maxPerDay - used);
    return {
        day: save.day,
        maxPerDay,
        used,
        remaining,
        usedActions,
        label: `${remaining}/${maxPerDay}`,
    };
}

export function createEventSummary(event: TownEvent): TownEventSummaryViewModel {
    return {
        id: event.id,
        type: event.type,
        label: formatEventType(event.type),
        title: event.title,
        content: event.content,
        hasChoices: Boolean(event.choices?.length),
        createdAt: event.createdAt,
        event,
    };
}

function getPrimaryBuildingAction(buildingId: string): "operate" | "visit" | "explore" {
    if (buildingId === "restaurant") return "operate";
    if (buildingId === "florist") return "visit";
    return "explore";
}

function isBudgetedAction(action: string) {
    return ["operate", "visit", "decorate", "explore", "upgrade"].includes(action);
}
