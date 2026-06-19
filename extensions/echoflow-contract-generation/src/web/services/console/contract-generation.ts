import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { AdminContractGenerationConfig, AdminContractGenerationTask, AiModelOption, ContractTemplate, PaginatedResponse, QueryContractTasksParams, UpsertContractTemplateParams } from "../types";

const CONTRACT_CONFIG_QUERY_KEY = ["echoflow-contract-generation", "console", "config"] as const;
const AI_MODELS_QUERY_KEY = ["echoflow-contract-generation", "console", "models"] as const;
const CONTRACT_TEMPLATES_QUERY_KEY = ["echoflow-contract-generation", "console", "templates"] as const;
const CONTRACT_TASKS_QUERY_KEY = ["echoflow-contract-generation", "console", "tasks"] as const;

export function getAdminContractGenerationConfig() {
    return consoleHttpClient.get<AdminContractGenerationConfig>("/contract-generation/config");
}

export function updateAdminContractGenerationConfig(params: { modelId: string }) {
    return consoleHttpClient.patch<AdminContractGenerationConfig>("/contract-generation/config", params);
}

export function listAdminLlmModels() {
    return consoleHttpClient.get<AiModelOption[]>("/contract-generation/ai-models");
}

export function listAdminContractTemplates() {
    return consoleHttpClient.get<ContractTemplate[]>("/contract-generation/templates");
}

export function createAdminContractTemplate(params: UpsertContractTemplateParams) {
    return consoleHttpClient.post<ContractTemplate>("/contract-generation/templates", params);
}

export function updateAdminContractTemplate(id: string, params: UpsertContractTemplateParams) {
    return consoleHttpClient.patch<ContractTemplate>(`/contract-generation/templates/${id}`, params);
}

export function deleteAdminContractTemplate(id: string) {
    return consoleHttpClient.delete<{ success: boolean }>(`/contract-generation/templates/${id}`);
}

export function resetBuiltinContractTemplates() {
    return consoleHttpClient.post<ContractTemplate[]>("/contract-generation/templates/reset-builtin");
}

export function listAdminContractTasks(params?: QueryContractTasksParams) {
    return consoleHttpClient.get<PaginatedResponse<AdminContractGenerationTask>>("/contract-generation/tasks", { params });
}

export function getAdminContractTaskDetail(taskId: string) {
    return consoleHttpClient.get<AdminContractGenerationTask>(`/contract-generation/tasks/${taskId}`);
}

export function deleteAdminContractTask(taskId: string) {
    return consoleHttpClient.delete<{ success: boolean }>(`/contract-generation/tasks/${taskId}`);
}

export function useAdminContractGenerationConfigQuery() {
    return useQuery({ queryKey: CONTRACT_CONFIG_QUERY_KEY, queryFn: getAdminContractGenerationConfig });
}

export function useAdminLlmModelsQuery() {
    return useQuery({ queryKey: AI_MODELS_QUERY_KEY, queryFn: listAdminLlmModels });
}

export function useUpdateAdminContractGenerationConfigMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: updateAdminContractGenerationConfig, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_CONFIG_QUERY_KEY }) });
}

export function useAdminContractTemplatesQuery() {
    return useQuery({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY, queryFn: listAdminContractTemplates });
}

export function useCreateAdminContractTemplateMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: createAdminContractTemplate, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY }) });
}

export function useUpdateAdminContractTemplateMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ id, params }: { id: string; params: UpsertContractTemplateParams }) => updateAdminContractTemplate(id, params), onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY }) });
}

export function useDeleteAdminContractTemplateMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: deleteAdminContractTemplate, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY }) });
}

export function useResetBuiltinContractTemplatesMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: resetBuiltinContractTemplates, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TEMPLATES_QUERY_KEY }) });
}

export function useAdminContractTasksQuery(params?: QueryContractTasksParams) {
    return useQuery({ queryKey: [...CONTRACT_TASKS_QUERY_KEY, params], queryFn: () => listAdminContractTasks(params) });
}

export function useAdminContractTaskDetailQuery(taskId?: string) {
    return useQuery({ queryKey: [...CONTRACT_TASKS_QUERY_KEY, "detail", taskId], queryFn: () => getAdminContractTaskDetail(taskId!), enabled: Boolean(taskId) });
}

export function useDeleteAdminContractTaskMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: deleteAdminContractTask, onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_TASKS_QUERY_KEY }) });
}
