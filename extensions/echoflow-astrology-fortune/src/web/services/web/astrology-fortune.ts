import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { AstrologyGenerationStatus, AstrologyProfile, AstrologyProfileInput, AstrologyReport, GenerateAstrologyReportParams, PaginatedResponse, QueryAstrologyReportsParams, UpdateReportFeedbackParams } from "../types";

const GENERATION_STATUS_QUERY_KEY = ["echoflow-astrology-fortune", "generation-status"] as const;
const PROFILE_QUERY_KEY = ["echoflow-astrology-fortune", "profiles"] as const;
const REPORT_QUERY_KEY = ["echoflow-astrology-fortune", "reports"] as const;
const quietQueryOptions = { retry: false, staleTime: 30_000 } as const;

export function getAstrologyGenerationStatus() {
    return apiHttpClient.get<AstrologyGenerationStatus>("/astrology-fortune/generation-status", { silent: true });
}

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
    return apiHttpClient.get<PaginatedResponse<AstrologyProfile>>("/astrology-fortune/profiles", { query: { pageSize: 50 }, silent: true });
}

export function generateAstrologyReport(params: GenerateAstrologyReportParams) {
    return apiHttpClient.post<AstrologyReport>("/astrology-fortune/reports/generate", params);
}

export function listAstrologyReports(params?: QueryAstrologyReportsParams) {
    return apiHttpClient.get<PaginatedResponse<AstrologyReport>>("/astrology-fortune/reports", { query: params, silent: true });
}

export function updateReportFavorite(reportId: string, isFavorite: boolean) {
    return apiHttpClient.patch<AstrologyReport>(`/astrology-fortune/reports/${reportId}/favorite`, { isFavorite });
}

export function updateReportFeedback(reportId: string, params: UpdateReportFeedbackParams) {
    return apiHttpClient.patch<AstrologyReport>(`/astrology-fortune/reports/${reportId}/feedback`, params);
}

export function deleteAstrologyReport(reportId: string) {
    return apiHttpClient.delete<{ success: boolean }>(`/astrology-fortune/reports/${reportId}`);
}

export function useAstrologyProfilesQuery() {
    return useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: listAstrologyProfiles, ...quietQueryOptions });
}

export function useAstrologyGenerationStatusQuery() {
    return useQuery({ queryKey: GENERATION_STATUS_QUERY_KEY, queryFn: getAstrologyGenerationStatus, ...quietQueryOptions });
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
        ...quietQueryOptions,
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

export function useUpdateReportFeedbackMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ reportId, params }: { reportId: string; params: UpdateReportFeedbackParams }) => updateReportFeedback(reportId, params),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY }),
    });
}

export function useDeleteAstrologyReportMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: deleteAstrologyReport, onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEY }) });
}
