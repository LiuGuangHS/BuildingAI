import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { ContractGenerationConfig, ContractGenerationTask, ContractGenerationVersion, ContractTemplate, ExportContractParams, GenerateContractParams, PaginatedResponse, QueryContractTasksParams, ReviewUploadedContractParams, RewriteContractClauseParams, RewriteContractClauseResult, UpdateContractContentParams, UpdateRiskActionParams } from "../types";

const CONTRACT_TASKS_QUERY_KEY = ["echoflow-contract-generation", "web", "tasks"] as const;
const CONTRACT_TEMPLATES_QUERY_KEY = ["echoflow-contract-generation", "web", "templates"] as const;
const CONTRACT_CONFIG_QUERY_KEY = ["echoflow-contract-generation", "web", "config"] as const;

export function listContractTemplates() {
    return apiHttpClient.get<ContractTemplate[]>("/contract-generation/templates");
}

export function getContractGenerationConfig() {
    return apiHttpClient.get<ContractGenerationConfig>("/contract-generation/config");
}

export function generateContract(params: GenerateContractParams) {
    return apiHttpClient.post<ContractGenerationTask>("/contract-generation/generate", params);
}

export function reviewUploadedContract(params: ReviewUploadedContractParams) {
    return apiHttpClient.post<ContractGenerationTask>("/contract-generation/review-upload", params);
}

export function reviewContractTask(taskId: string) {
    return apiHttpClient.post<ContractGenerationTask>(`/contract-generation/tasks/${taskId}/review`);
}

export function rewriteContractClause(taskId: string, params: RewriteContractClauseParams) {
    return apiHttpClient.post<RewriteContractClauseResult>(`/contract-generation/tasks/${taskId}/rewrite-clause`, params);
}

export function updateContractContent(taskId: string, params: UpdateContractContentParams) {
    return apiHttpClient.patch<ContractGenerationTask>(`/contract-generation/tasks/${taskId}/content`, params);
}

export function updateRiskAction(taskId: string, params: UpdateRiskActionParams) {
    return apiHttpClient.patch<ContractGenerationTask>(`/contract-generation/tasks/${taskId}/risk-actions`, params);
}

export function listContractVersions(taskId: string) {
    return apiHttpClient.get<ContractGenerationVersion[]>(`/contract-generation/tasks/${taskId}/versions`);
}

export function restoreContractVersion(taskId: string, versionId: string) {
    return apiHttpClient.post<ContractGenerationTask>(`/contract-generation/tasks/${taskId}/versions/${versionId}/restore`);
}

export function exportContractTask(taskId: string, params?: ExportContractParams) {
    return apiHttpClient.post<ContractGenerationTask>(`/contract-generation/tasks/${taskId}/export`, params ?? {});
}

export function listContractTasks(params?: QueryContractTasksParams) {
    return apiHttpClient.get<PaginatedResponse<ContractGenerationTask>>("/contract-generation/tasks", { params });
}

export function getContractTaskDetail(taskId: string) {
    return apiHttpClient.get<ContractGenerationTask>(`/contract-generation/tasks/${taskId}`);
}

export function deleteContractTask(taskId: string) {
    return apiHttpClient.delete<{ success: boolean }>(`/contract-generation/tasks/${taskId}`);
}

export function useContractTemplatesQuery() {
    return useQuery({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY, queryFn: listContractTemplates });
}

export function useContractGenerationConfigQuery() {
    return useQuery({ queryKey: CONTRACT_CONFIG_QUERY_KEY, queryFn: getContractGenerationConfig });
}

export function useGenerateContractMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: generateContract, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useReviewUploadedContractMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: reviewUploadedContract, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useReviewContractMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: reviewContractTask, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useRewriteContractClauseMutation() {
    return useMutation({ mutationFn: ({ taskId, params }: { taskId: string; params: RewriteContractClauseParams }) => rewriteContractClause(taskId, params) });
}

export function useUpdateContractContentMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ taskId, params }: { taskId: string; params: UpdateContractContentParams }) => updateContractContent(taskId, params), onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useUpdateRiskActionMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ taskId, params }: { taskId: string; params: UpdateRiskActionParams }) => updateRiskAction(taskId, params), onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useContractVersionsQuery(taskId?: string) {
    return useQuery({ queryKey: [...CONTRACT_TASKS_QUERY_KEY, "versions", taskId], queryFn: () => listContractVersions(taskId!), enabled: Boolean(taskId) });
}

export function useContractTaskDetailQuery(taskId?: string) {
    return useQuery({
        queryKey: [...CONTRACT_TASKS_QUERY_KEY, "detail", taskId],
        queryFn: () => getContractTaskDetail(taskId!),
        enabled: Boolean(taskId),
        refetchInterval: (query) => {
            const task = query.state.data;
            return task && ["pending", "processing", "reviewing", "exporting"].includes(task.status) ? 3000 : false;
        },
    });
}

export function useRestoreContractVersionMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ taskId, versionId }: { taskId: string; versionId: string }) => restoreContractVersion(taskId, versionId), onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useExportContractMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ taskId, params }: { taskId: string; params?: ExportContractParams }) => exportContractTask(taskId, params), onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}

export function useContractTasksQuery(params?: QueryContractTasksParams) {
    return useQuery({
        queryKey: [...CONTRACT_TASKS_QUERY_KEY, params],
        queryFn: () => listContractTasks(params),
        refetchInterval: (query) => {
            const items = query.state.data?.items ?? [];
            return items.some((task) => ["pending", "processing", "reviewing", "exporting"].includes(task.status)) ? 3000 : false;
        },
    });
}
