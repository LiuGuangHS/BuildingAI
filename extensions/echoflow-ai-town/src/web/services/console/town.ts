import { consoleHttpClient } from "../base";
import type { TownAiConfig, TownAiLogsResult, TownAiModel, TownSave, TownSaveListResult, TownStatistics } from "../types";

export function listConsoleTownSaves(params?: { keyword?: string; page?: number; pageSize?: number }) {
    return consoleHttpClient.get<TownSaveListResult>("/ai-town/saves", { params });
}

export function deleteConsoleTownSave(saveId: string) {
    return consoleHttpClient.delete<{ success: boolean }>(`/ai-town/saves/${saveId}`);
}

export function getConsoleTownSave(saveId: string) {
    return consoleHttpClient.get<TownSave>(`/ai-town/saves/${saveId}`);
}

export function getTownStatistics() {
    return consoleHttpClient.get<TownStatistics>("/ai-town/statistics");
}

export function getTownAiConfig() {
    return consoleHttpClient.get<TownAiConfig>("/ai-town/ai-config");
}

export function updateTownAiConfig(params: TownAiConfig) {
    return consoleHttpClient.put<TownAiConfig>("/ai-town/ai-config", params);
}

export function listTownAiModels() {
    return consoleHttpClient.get<TownAiModel[]>("/ai-town/ai-models");
}

export function getTownAiLogs(params?: { type?: string; success?: boolean; fallbackUsed?: boolean; saveId?: string }) {
    return consoleHttpClient.get<TownAiLogsResult>("/ai-town/ai-logs", { params });
}

export function testTownAi(prompt?: string) {
    return consoleHttpClient.post<{ text: string }>("/ai-town/ai-config/test", { prompt });
}
