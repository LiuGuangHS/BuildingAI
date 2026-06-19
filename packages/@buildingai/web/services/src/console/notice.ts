import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export type AliyunSmsConfig = {
    sign: string;
    accessKeyId: string;
    accessKeySecret: string;
    templateCode?: string;
    loginTemplateCode?: string;
    registerTemplateCode?: string;
    bindMobileTemplateCode?: string;
    changeMobileTemplateCode?: string;
    findPasswordTemplateCode?: string;
    enable?: boolean;
};

export type TencentSmsConfig = {
    sign: string;
    appId: string;
    accessKeyId: string;
    accessKeySecret: string;
    templateCode?: string;
    enable?: boolean;
};

export type UpdateAliyunSmsConfigDto = Omit<AliyunSmsConfig, "enable">;
export type UpdateTencentSmsConfigDto = Omit<TencentSmsConfig, "enable">;

export type UpdateSmsConfigStatusDto = {
    enable: boolean;
};

export type SmsSceneSetting = {
    scene: number;
    sceneName: string;
    noticeType: "验证码";
    smsEnabled: boolean;
    smsTemplateId: string;
    smsContent: string;
    emailEnabled: boolean | null;
};

export type UpdateSmsSceneSettingDto = {
    enable: boolean;
    templateId: string;
    content: string;
};

type QueryOptionsUtil<T> = any;

/**
 * 获取阿里云短信配置
 */
export function useAliyunSmsConfigQuery(options?: QueryOptionsUtil<AliyunSmsConfig>) {
    return useQuery<AliyunSmsConfig>({
        queryKey: ["notice", "sms-config", "aliyun"],
        queryFn: () => consoleHttpClient.get<AliyunSmsConfig>("/notice/sms-config/aliyun"),
        ...options,
    });
}

/**
 * 获取通知设置中的短信场景配置列表
 */
export function useSmsSceneSettingsQuery(options?: QueryOptionsUtil<SmsSceneSetting[]>) {
    return useQuery<SmsSceneSetting[]>({
        queryKey: ["notice", "sms-scene-settings"],
        queryFn: () => consoleHttpClient.get<SmsSceneSetting[]>("/notice/sms-scene-settings"),
        ...options,
    });
}

/**
 * 更新单个短信场景配置
 */
export function useUpdateSmsSceneSettingMutation(scene: number, options?: any) {
    return useMutation<SmsSceneSetting, Error, UpdateSmsSceneSettingDto>({
        mutationFn: (data) =>
            consoleHttpClient.patch<SmsSceneSetting>(`/notice/sms-scene-settings/${scene}`, data),
        ...options,
    });
}

/**
 * 获取腾讯云短信配置
 */
export function useTencentSmsConfigQuery(options?: QueryOptionsUtil<TencentSmsConfig>) {
    return useQuery<TencentSmsConfig>({
        queryKey: ["notice", "sms-config", "tencent"],
        queryFn: () => consoleHttpClient.get<TencentSmsConfig>("/notice/sms-config/tencent"),
        ...options,
    });
}

/**
 * 更新阿里云短信配置
 */
export function useUpdateAliyunSmsConfigMutation(options?: any) {
    return useMutation<AliyunSmsConfig, Error, UpdateAliyunSmsConfigDto>({
        mutationFn: (data) =>
            consoleHttpClient.post<AliyunSmsConfig>("/notice/sms-config/aliyun", data),
        ...options,
    });
}

/**
 * 更新腾讯云短信配置
 */
export function useUpdateTencentSmsConfigMutation(options?: any) {
    return useMutation<TencentSmsConfig, Error, UpdateTencentSmsConfigDto>({
        mutationFn: (data) =>
            consoleHttpClient.post<TencentSmsConfig>("/notice/sms-config/tencent", data),
        ...options,
    });
}

/**
 * 更新短信渠道启用状态（互斥启用）
 */
export function useUpdateSmsConfigStatusMutation(provider: "aliyun" | "tencent", options?: any) {
    return useMutation<AliyunSmsConfig | TencentSmsConfig, Error, { enable: boolean }>({
        mutationFn: (data) =>
            consoleHttpClient.patch<AliyunSmsConfig | TencentSmsConfig>(
                `/notice/sms-config/${provider}/status`,
                data,
            ),
        ...options,
    });
}

export type NotificationScene = {
    id: string;
    sceneCode: string;
    extensionId?: string | null;
    name: string;
    description?: string | null;
    isEnabled: boolean;
    level: string;
    channels: string[];
    titleTemplate: string;
    contentTemplate?: string | null;
    linkUrlTemplate?: string | null;
    wechatTemplate?: Record<string, any> | null;
    userConfigurable: boolean;
    createdAt: string;
    updatedAt: string;
};

export type UpdateNotificationSceneDto = Partial<
    Pick<
        NotificationScene,
        | "isEnabled"
        | "level"
        | "channels"
        | "titleTemplate"
        | "contentTemplate"
        | "linkUrlTemplate"
        | "wechatTemplate"
        | "userConfigurable"
    >
>;

export type NotificationChannelStatus = {
    channel: string;
    name: string;
    enabled: boolean;
    ready: boolean;
    description: string;
};

export type NotificationDelivery = {
    id: string;
    notificationId: string;
    userId: string;
    sceneCode: string;
    extensionId?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    channel: string;
    status: string;
    attempts: number;
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    payload?: Record<string, any> | null;
    sentAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type NotificationDeliveryListResponse = {
    items: NotificationDelivery[];
    total: number;
    page: number;
    pageSize: number;
};

export function useNotificationScenesQuery(options?: QueryOptionsUtil<NotificationScene[]>) {
    return useQuery<NotificationScene[]>({
        queryKey: ["notification", "scenes"],
        queryFn: () => consoleHttpClient.get<NotificationScene[]>("/notification/scenes"),
        ...options,
    });
}

export function useUpdateNotificationSceneMutation(sceneCode: string, options?: any) {
    return useMutation<NotificationScene, Error, UpdateNotificationSceneDto>({
        mutationFn: (data) =>
            consoleHttpClient.patch<NotificationScene>(
                `/notification/scenes/${sceneCode}`,
                data,
            ),
        ...options,
    });
}

export function useTestNotificationSceneMutation(sceneCode: string, options?: any) {
    return useMutation<any, Error, { userId?: string; channels?: string[] }>({
        mutationFn: (data) =>
            consoleHttpClient.post<any>(`/notification/scenes/${sceneCode}/test`, data),
        ...options,
    });
}

export function useNotificationChannelsQuery(options?: QueryOptionsUtil<NotificationChannelStatus[]>) {
    return useQuery<NotificationChannelStatus[]>({
        queryKey: ["notification", "channels"],
        queryFn: () => consoleHttpClient.get<NotificationChannelStatus[]>("/notification/channels"),
        ...options,
    });
}

export function useNotificationDeliveriesQuery(
    params?: { page?: number; pageSize?: number; extensionId?: string; sceneCode?: string; channel?: string; status?: string; userId?: string },
    options?: QueryOptionsUtil<NotificationDeliveryListResponse>,
) {
    return useQuery<NotificationDeliveryListResponse>({
        queryKey: ["notification", "deliveries", params],
        queryFn: () =>
            consoleHttpClient.get<NotificationDeliveryListResponse>("/notification/deliveries", {
                params,
            }),
        ...options,
    });
}
