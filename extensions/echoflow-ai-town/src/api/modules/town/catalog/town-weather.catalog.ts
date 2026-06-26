export interface TownWeatherEffect {
    operateCoins: number;
    visitReputation: number;
    exploreReputation: number;
    exploreStaminaCost: number;
    reputationMultiplier: number;
}

export const TOWN_WEATHER_CATALOG: Record<string, TownWeatherEffect> = {
    晴朗: { operateCoins: 1.1, visitReputation: 0, exploreReputation: 0, exploreStaminaCost: 0, reputationMultiplier: 1 },
    小雨: { operateCoins: 0.95, visitReputation: 1, exploreReputation: 0, exploreStaminaCost: 0, reputationMultiplier: 1 },
    微风: { operateCoins: 1, visitReputation: 0, exploreReputation: 1, exploreStaminaCost: 0, reputationMultiplier: 1 },
    夜雾: { operateCoins: 1, visitReputation: 0, exploreReputation: 2, exploreStaminaCost: 2, reputationMultiplier: 1 },
    节庆日: { operateCoins: 1.05, visitReputation: 1, exploreReputation: 1, exploreStaminaCost: 0, reputationMultiplier: 1.2 },
};

export const DEFAULT_WEATHER_EFFECT: TownWeatherEffect = TOWN_WEATHER_CATALOG.晴朗;