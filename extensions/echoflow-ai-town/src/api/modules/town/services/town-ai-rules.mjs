export const TOWN_AI_CONFIG_KEY = "default";

export const TOWN_AI_DEFAULT_CONFIG = {
    enabled: false,
    defaultModelId: null,
    temperature: 0.8,
    maxTokens: 1200,
    fallbackToRules: true,
    dailyLimitPerUser: 100,
};

export function getTownAiDayStart(now = new Date()) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart;
}

export function shouldUseTownAiDailyLimit(config) {
    return Boolean(config?.enabled && config?.defaultModelId && Number(config?.dailyLimitPerUser ?? 0) > 0);
}

export function hasTownAiDailyLimitReached(count, limit) {
    return Number(limit ?? 0) > 0 && count >= Number(limit);
}
