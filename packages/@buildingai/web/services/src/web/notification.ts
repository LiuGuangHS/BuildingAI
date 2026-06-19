import { useAuthStore } from "@buildingai/stores";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type NotificationItem = {
    id: string;
    userId: string;
    title: string;
    content?: string | null;
    type: string;
    level: string;
    linkUrl?: string | null;
    data?: Record<string, unknown> | null;
    readAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type NotificationListResponse = {
    items: NotificationItem[];
    total: number;
    page: number;
    pageSize: number;
};

export type NotificationUnreadCountResponse = {
    count: number;
};

export type NotificationPushPublicKeyResponse = {
    publicKey: string;
};

export type NotificationPushStatusResponse = {
    enabled: boolean;
    subscriptionCount: number;
};

export type NotificationPreferenceScene = {
    sceneCode: string;
    name: string;
    description?: string | null;
    enabled: boolean;
    channels: string[];
};

export type NotificationPreferencesResponse = {
    disabledScenes: string[];
    scenes: NotificationPreferenceScene[];
};

export type NotificationPushSubscriptionPayload = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
};

export function useNotificationPreferencesQuery(options?: {
    enabled?: boolean;
}): UseQueryResult<NotificationPreferencesResponse, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
    return useQuery<NotificationPreferencesResponse>({
        queryKey: ["notifications", "preferences"],
        queryFn: () => apiHttpClient.get<NotificationPreferencesResponse>("/notifications/preferences"),
        enabled: isLogin() && options?.enabled !== false,
        ...options,
    });
}

export function useUpdateNotificationPreferencesMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<NotificationPreferencesResponse, Error, { disabledScenes: string[] }>({
        mutationFn: (payload) =>
            apiHttpClient.patch<NotificationPreferencesResponse>(
                "/notifications/preferences",
                payload,
            ),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
            options?.onSuccess?.(...args);
        },
    });
}

export function useNotificationsQuery(
    params?: { page?: number; pageSize?: number; readStatus?: "all" | "read" | "unread" },
    options?: { enabled?: boolean; refetchInterval?: number },
): UseQueryResult<NotificationListResponse, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
    return useQuery<NotificationListResponse>({
        queryKey: ["notifications", params],
        queryFn: () => apiHttpClient.get<NotificationListResponse>("/notifications", { params }),
        enabled: isLogin() && options?.enabled !== false,
        ...options,
    });
}

export function useNotificationUnreadCountQuery(options?: {
    enabled?: boolean;
    refetchInterval?: number;
}): UseQueryResult<NotificationUnreadCountResponse, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
    return useQuery<NotificationUnreadCountResponse>({
        queryKey: ["notifications", "unread-count"],
        queryFn: () =>
            apiHttpClient.get<NotificationUnreadCountResponse>("/notifications/unread-count"),
        enabled: isLogin() && options?.enabled !== false,
        ...options,
    });
}

export function useNotificationPushStatusQuery(options?: {
    enabled?: boolean;
}): UseQueryResult<NotificationPushStatusResponse, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
    return useQuery<NotificationPushStatusResponse>({
        queryKey: ["notifications", "push", "status"],
        queryFn: () =>
            apiHttpClient.get<NotificationPushStatusResponse>("/notifications/push/status"),
        enabled: isLogin() && options?.enabled !== false,
        ...options,
    });
}

export function useNotificationPushPublicKeyQuery(options?: {
    enabled?: boolean;
}): UseQueryResult<NotificationPushPublicKeyResponse, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
    return useQuery<NotificationPushPublicKeyResponse>({
        queryKey: ["notifications", "push", "public-key"],
        queryFn: () =>
            apiHttpClient.get<NotificationPushPublicKeyResponse>("/notifications/push/public-key"),
        enabled: isLogin() && options?.enabled !== false,
        staleTime: Infinity,
        ...options,
    });
}

export function useSubscribeNotificationPushMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<NotificationPushStatusResponse, Error, NotificationPushSubscriptionPayload>({
        mutationFn: (payload) =>
            apiHttpClient.post<NotificationPushStatusResponse>(
                "/notifications/push/subscribe",
                payload,
            ),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications", "push", "status"] });
            options?.onSuccess?.(...args);
        },
    });
}

export function useUnsubscribeNotificationPushMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<NotificationPushStatusResponse, Error, { endpoint?: string } | undefined>({
        mutationFn: (payload) =>
            apiHttpClient.post<NotificationPushStatusResponse>(
                "/notifications/push/unsubscribe",
                payload ?? {},
            ),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications", "push", "status"] });
            options?.onSuccess?.(...args);
        },
    });
}

export function useCreateTestNotificationMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<NotificationItem, Error>({
        mutationFn: () => apiHttpClient.post<NotificationItem>("/notifications/test"),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            options?.onSuccess?.(...args);
        },
    });
}

export function useMarkNotificationReadMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<NotificationItem, Error, string>({
        mutationFn: (id) => apiHttpClient.patch<NotificationItem>(`/notifications/${id}/read`),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            options?.onSuccess?.(...args);
        },
    });
}

export function useMarkAllNotificationsReadMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<{ success: boolean }, Error, void>({
        mutationFn: () => apiHttpClient.patch<{ success: boolean }>("/notifications/read-all"),
        ...options,
        onSuccess: (...args) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            options?.onSuccess?.(...args);
        },
    });
}
