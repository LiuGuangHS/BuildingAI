import { apiHttpClient } from "../base";
import type { TownSave, TownSaveListResult } from "../types";

export function createTownSave(name?: string) {
    return apiHttpClient.post<TownSave>("/ai-town/saves", { name });
}

export function listTownSaves() {
    return apiHttpClient.get<TownSaveListResult>("/ai-town/saves");
}

export function getTownSave(saveId: string) {
    return apiHttpClient.get<TownSave>(`/ai-town/saves/${saveId}`);
}

export function deleteTownSave(saveId: string) {
    return apiHttpClient.delete<{ success: boolean }>(`/ai-town/saves/${saveId}`);
}

export function runTownAction(saveId: string, action: string, choiceId?: string, buildingId?: string) {
    return apiHttpClient.post<TownSave>(`/ai-town/saves/${saveId}/action`, { action, choiceId, buildingId });
}

export function chatWithTownCharacter(saveId: string, characterId: string, message: string) {
    return apiHttpClient.post<{ reply: string; save: TownSave }>(`/ai-town/saves/${saveId}/chat`, { characterId, message });
}
