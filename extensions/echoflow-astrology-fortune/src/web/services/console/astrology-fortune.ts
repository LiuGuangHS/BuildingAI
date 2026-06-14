import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { AiModelOption, AstrologyFortuneSetting, AstrologyProfile, AstrologyReport, PaginatedResponse, QueryAstrologyProfilesParams, QueryAstrologyReportsParams, UpdateAstrologyFortuneSettingParams } from "../types";

const SETTING_QUERY_KEY = ["echoflow-astrology-fortune", "console", "settings"] as const;
const MODEL_QUERY_KEY = ["echoflow-astrology-fortune", "console", "llm-models"] as const;
const REPORTS_QUERY_KEY = ["echoflow-astrology-fortune", "console", "reports"] as const;
const PROFILES_QUERY_KEY = ["echoflow-astrology-fortune", "console", "profiles"] as const;

export function getAstrologyFortuneSetting() {
    return consoleHttpClient.get<AstrologyFortuneSetting>("/astrology-fortune/settings");
}

export function updateAstrologyFortuneSetting(params: UpdateAstrologyFortuneSettingParams) {
    return consoleHttpClient.patch<AstrologyFortuneSetting>("/astrology-fortune/settings", params);
}

export function listAvailableLlmModels() {
    return consoleHttpClient.get<AiModelOption[]>("/astrology-fortune/ai-models");
}

export function listConsoleAstrologyReports(params?: QueryAstrologyReportsParams) {
    return consoleHttpClient.get<PaginatedResponse<AstrologyReport>>("/astrology-fortune/reports", { params });
}

export function getConsoleAstrologyReport(reportId: string) {
    return consoleHttpClient.get<AstrologyReport>(`/astrology-fortune/reports/${reportId}`);
}

export function deleteConsoleAstrologyReport(reportId: string) {
    return consoleHttpClient.delete<{ success: boolean }>(`/astrology-fortune/reports/${reportId}`);
}

export function listConsoleAstrologyProfiles(params?: QueryAstrologyProfilesParams) {
    return consoleHttpClient.get<PaginatedResponse<AstrologyProfile>>("/astrology-fortune/profiles", { params });
}

export function useAstrologyFortuneSettingQuery() {
    return useQuery({ queryKey: SETTING_QUERY_KEY, queryFn: getAstrologyFortuneSetting });
}

export function useAvailableLlmModelsQuery() {
    return useQuery({ queryKey: MODEL_QUERY_KEY, queryFn: listAvailableLlmModels });
}

export function useConsoleAstrologyReportsQuery(params?: QueryAstrologyReportsParams) {
    return useQuery({ queryKey: [...REPORTS_QUERY_KEY, params], queryFn: () => listConsoleAstrologyReports(params) });
}

export function useConsoleAstrologyProfilesQuery(params?: QueryAstrologyProfilesParams) {
    return useQuery({ queryKey: [...PROFILES_QUERY_KEY, params], queryFn: () => listConsoleAstrologyProfiles(params) });
}

export function useConsoleAstrologyReportDetailQuery(reportId?: string) {
    return useQuery({ queryKey: [...REPORTS_QUERY_KEY, "detail", reportId], queryFn: () => getConsoleAstrologyReport(reportId!), enabled: !!reportId });
}

export function useUpdateAstrologyFortuneSettingMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateAstrologyFortuneSetting,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTING_QUERY_KEY }),
    });
}

export function useDeleteConsoleAstrologyReportMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: deleteConsoleAstrologyReport, onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }) });
}
