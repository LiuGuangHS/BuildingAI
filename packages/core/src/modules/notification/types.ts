export type NotificationChannel = "in_app" | "web_push" | "wechat_oa_template" | "sms";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export type RegisterNotificationSceneInput = {
    sceneCode: string;
    name: string;
    description?: string | null;
    level?: NotificationLevel;
    channels?: NotificationChannel[];
    titleTemplate: string;
    contentTemplate?: string | null;
    linkUrlTemplate?: string | null;
    wechatTemplate?: Record<string, unknown> | null;
    userConfigurable?: boolean;
};

export type NotifyUserInput = {
    userId: string;
    sceneCode: string;
    title?: string;
    content?: string | null;
    type?: string;
    level?: NotificationLevel;
    linkUrl?: string | null;
    data?: Record<string, unknown>;
    sourceType?: string;
    sourceId?: string;
    dedupeKey?: string;
    channels?: NotificationChannel[];
};

export type NotifyUserResult = {
    notificationId?: string;
    skipped?: boolean;
    reason?: string;
};

export type ExtensionNotificationSceneInput = RegisterNotificationSceneInput & {
    extensionId?: string;
};

export type ExtensionNotifyUserInput = NotifyUserInput & {
    extensionId?: string;
};

export interface ExtensionNotificationPort {
    registerScenes(
        extensionId: string,
        scenes: RegisterNotificationSceneInput[],
    ): Promise<void>;
    notifyUser(extensionId: string, input: NotifyUserInput): Promise<NotifyUserResult>;
}
