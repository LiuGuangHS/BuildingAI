import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { AstrologyProfile, AstrologyProfileInput, AstrologyReport, GenerateAstrologyReportParams, PaginatedResponse, QueryAstrologyReportsParams } from "../types";

const PROFILE_QUERY_KEY = ["echoflow-astrology-fortune", "profiles"] as const;
const REPORT_QUERY_KEY = ["echoflow-astrology-fortune", "reports"] as const;

export function createAstrologyProfile(params: AstrologyProfileInput) {
    return apiHttpClient.post<AstrologyProfile>("/astrology-fortune/profiles", params);
}

export function updateAstrologyProfile(profileId: string, params: Partial<AstrologyProfileInput>) {
    return apiHttpClient.patch<AstrologyProfile>(`/astrology-fortune/profiles/${profileId}`, params);
}

export function deleteAstrologyProfile(profileId: string) {
    return apiHttpClient.delete<{ success: boolean }>(`/astrology-fortune/profiles/${profileId}`);
}

export function listAstrologyProfiles() {
    return apiHttpClient.get<PaginatedResponse<AstrologyProfile>>("/astrology-fortune/profiles", { params: { pageSize: 50 } });
}

export function generateAstrologyReport(params: GenerateAstrologyReportParams) {
    return apiHttpClient.post<AstrologyReport>("/astrology-fortune/reports/generate", params);
}

export function listAstrologyReports(params?: QueryAstrologyReportsParams) {
    return apiHttpClient.get<PaginatedResponse<AstrologyReport>>("/astrology-fortune/reports", { params });
}

export function updateReportFavorite(reportId: string, isFavorite: boolean) {
    return apiHttpClient.patch<AstrologyReport>(`/astrology-fortune/reports/${reportId}/favorite`, { isFavorite });
}

export function deleteAstrologyReport(reportId: string) {
    return apiHttpClient.delete<{ success: boolean }>(`/astrology-fortune/reports/${reportId}`);
}

export function useAstrologyProfilesQuery() {
    return useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: listAstrologyProfiles });
}

export function useCreateAstrologyProfileMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: createAstrologyProfile, onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }) });
}

export function useUpdateAstrologyProfileMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ profileId, params }: { profileId: string; params: Partial<AstrologyProfileInput> }) => updateAstrologyProfile(profileId, params),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
    });
}

export function useDeleteAstrologyProfileMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteAstrologyProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY });
        },
    });
}

export function useGenerateAstrologyReportMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: generateAstrologyReport, onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY }) });
}

export function useAstrologyReportsQuery(params?: QueryAstrologyReportsParams) {
    return useQuery({
        queryKey: [...REPORT_QUERY_KEY, params],
        queryFn: () => listAstrologyReports(params),
        refetchInterval: (query) => (query.state.data?.items.some((report) => report.status === "pending" || report.status === "processing") ? 3000 : false),
    });
}

export function useUpdateReportFavoriteMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ reportId, isFavorite }: { reportId: string; isFavorite: boolean }) => updateReportFavorite(reportId, isFavorite),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY }),
    });
}

export function useDeleteAstrologyReportMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: deleteAstrologyReport, onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY }) });
}
