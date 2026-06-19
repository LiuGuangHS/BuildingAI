export type TownBuilding = {
    id: string;
    name: string;
    level: number;
    status: string;
    effect?: string;
    maxLevel?: number;
};

export type TownWorldState = {
    reputation: number;
    weather: string;
    focus: string;
    unlockedAreas: string[];
    buildings: TownBuilding[];
    flags?: Record<string, unknown>;
    dailyTasks?: TownTask[];
    weeklyGoal?: TownGoal | null;
    mainQuest?: TownQuestState;
    achievements?: string[];
    activeFestival?: TownFestivalState | null;
    lastSettlement?: {
        day: number;
        weather: string;
        income: number;
        maintenance: number;
        reputation: number;
        summary: string;
        breakdown?: Array<{ label: string; value: number; detail: string }>;
    } | null;
    retention?: TownRetentionState;
};

export type TownRetentionState = {
    streak: number;
    lastQualifiedDay: number;
    todayQualified: boolean;
    nextHook: {
        day: number;
        title: string;
        desc: string;
        action: "operate" | "visit" | "decorate" | "explore" | "upgrade" | "chat" | "rest";
        target?: string;
        targetLabel: string;
        reason: string;
    };
};

export type TownFestivalState = {
    key: string;
    title: string;
    desc: string;
    status: "announced" | "preparing" | "ready" | "completed";
    progress: number;
    target: number;
    daysLeft: number;
    action: "operate" | "visit" | "decorate" | "explore" | "upgrade";
    reward: { coins?: number; reputation?: number; stamina?: number; relationship?: Record<string, number>; unlockArea?: string };
};

export type TownTask = {
    id: string;
    title: string;
    desc: string;
    type: "operate" | "visit" | "explore" | "decorate" | "upgrade" | "chat" | "earnCoins" | "gainReputation";
    target: number;
    progress: number;
    reward: { coins?: number; stamina?: number; reputation?: number };
    completed: boolean;
};

export type TownGoal = {
    id: string;
    title: string;
    desc: string;
    type: "completeTasks" | "upgrade" | "gainReputation" | "explore";
    target: number;
    progress: number;
    reward: { coins?: number; stamina?: number; reputation?: number };
    completed: boolean;
};

export type TownQuestState = {
    chapter: number;
    title: string;
    desc: string;
    requirements: Array<{ type: string; target: number; current: number }>;
    reward: { coins?: number; reputation?: number; unlockArea?: string };
    completed: boolean;
};

export type TownCharacter = {
    id: string;
    name: string;
    role: string;
    personality: string;
    relationship: number;
    status: string;
    memory?: {
        summary?: string;
        relationshipLevel?: string;
        lastEventTitle?: string;
        mood?: string;
        preferences?: string[];
        promises?: string[];
        keyMoments?: Array<{ day: number; title: string; summary: string }>;
        recentMessages?: Array<{ user: string; reply: string; at: string }>;
    } | null;
};

export type TownEvent = {
    id: string;
    type: string;
    title: string;
    content: string;
    choices?: Array<{ id: string; label: string; hint: string }> | null;
    result?: {
        coins?: number;
        stamina?: number;
        reputation?: number;
        relationship?: Record<string, number>;
        bonuses?: string[];
        audit?: {
            before: {
                coins: number;
                stamina: number;
                reputation: number;
                level: number;
            };
            after: {
                coins: number;
                stamina: number;
                reputation: number;
                level: number;
            };
            deltas: {
                coins: number;
                stamina: number;
                reputation: number;
                level: number;
            };
            ruleRefs: string[];
            source: "rules" | "model-assisted" | "settlement";
            action: {
                type: string;
                label: string;
                day: number;
                choiceId?: string;
                choiceLabel?: string;
                buildingId?: string;
                buildingName?: string;
                relationshipTargetId?: string;
                relationshipTargetName?: string;
            };
            budget?: {
                maxPerDay: number;
                usedBefore: number;
                usedAfter: number;
                consumed: boolean;
                remaining: number;
            };
            resourceBreakdown?: Array<{
                label: string;
                value: number;
                detail: string;
            }>;
            model?: {
                assisted: boolean;
                fallbackUsed: boolean;
            };
            notes: string[];
        };
        strategy?: TownStrategyAdvice;
        fallbackUsed?: boolean;
    } | null;
    createdAt: string;
};

export type TownStrategyAdvice = {
    summary: string;
    action: string;
    target: string;
    reason: string;
    risk: string;
    expected: string;
    nextStep: string;
};

export type TownSave = {
    id: string;
    name: string;
    level: number;
    coins: number;
    stamina: number;
    day: number;
    mood: string;
    worldState: TownWorldState;
    characters: TownCharacter[];
    events: TownEvent[];
    suggestion: string;
    updatedAt: string;
};

export type TownSaveListResult = {
    list: Array<Omit<TownSave, "characters" | "events" | "suggestion">>;
    total: number;
    page: number;
    pageSize: number;
};

export type TownAiConfig = {
    id?: string;
    enabled: boolean;
    defaultModelId?: string | null;
    temperature: number;
    maxTokens: number;
    fallbackToRules: boolean;
    dailyLimitPerUser: number;
};

export type TownAiModel = {
    id: string;
    name: string;
    model: string;
    modelType: string;
    providerId: string;
    providerName: string;
    provider: string;
    description?: string | null;
};

export type TownAiLog = {
    id: string;
    saveId?: string | null;
    type: "advice" | "chat" | "event" | "structured_event" | "test";
    modelId?: string | null;
    success: boolean;
    fallbackUsed: boolean;
    latencyMs: number;
    errorMessage?: string | null;
    createdAt: string;
};

export type TownAiLogsResult = {
    stats: {
        total: number;
        todayCount: number;
        failed: number;
        fallback: number;
    };
    logs: TownAiLog[];
};

export type TownStatistics = {
    saveCount: number;
    characterCount: number;
    eventCount: number;
    chatCount?: number;
    aiEventCount?: number;
    activeSaveCount?: number;
    averageDay?: number;
    averageLevel?: number;
    stuckSaveCount?: number;
    todaySaveCount?: number;
    recentActionCount?: number;
    averageEventCount?: number;
    aiSuccessRate?: number;
    aiFallbackRate?: number;
    topActionType?: string | null;
};
