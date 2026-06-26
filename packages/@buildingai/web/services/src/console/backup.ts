import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export interface BackupConfig {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
}

export interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
}

export function useBackupConfigQuery(options?: QueryOptionsUtil<BackupConfig>) {
    return useQuery<BackupConfig>({
        queryKey: ["backup", "config"],
        queryFn: () => consoleHttpClient.get<BackupConfig>("/system/backup/config"),
        ...options,
    });
}

export function useUpdateBackupConfigMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (config: Partial<Omit<BackupConfig, "schedule">>) =>
            consoleHttpClient.post<BackupConfig>("/system/backup/config", config),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["backup"] });
        },
    });
}

export function useBackupListQuery(options?: QueryOptionsUtil<BackupFile[]>) {
    return useQuery<BackupFile[]>({
        queryKey: ["backup", "list"],
        queryFn: () => consoleHttpClient.get<BackupFile[]>("/system/backups"),
        ...options,
    });
}

export function useCreateBackupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => consoleHttpClient.post<{ filename: string; size: number }>("/system/backups"),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["backup", "list"] });
        },
    });
}

export function useDeleteBackupMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (filename: string) => consoleHttpClient.delete(`/system/backups/${filename}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["backup", "list"] });
        },
    });
}
