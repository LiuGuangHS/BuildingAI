import { type ExtensionNotificationPort, type NotifyUserInput, type NotifyUserResult, type RegisterNotificationSceneInput } from "@buildingai/core/modules";
export type ExtensionRegisterNotificationSceneInput = RegisterNotificationSceneInput;
export type ExtensionNotifyUserInput = NotifyUserInput;
export declare class ExtensionNotificationService {
    private readonly notificationPort?;
    private readonly logger;
    constructor(notificationPort?: ExtensionNotificationPort | undefined);
    registerScenes(extensionIdOrScenes: string | RegisterNotificationSceneInput[], maybeScenes?: RegisterNotificationSceneInput[]): Promise<void>;
    notifyUser(input: ExtensionNotifyUserInput): Promise<NotifyUserResult>;
    private assertExplicitExtensionId;
    private normalizeScene;
    private normalizeNotification;
    private assertNamespacedScene;
    private requireResolvedExtensionId;
    private resolveExtensionId;
    private tryResolveExtensionId;
}
//# sourceMappingURL=extension-notification.service.d.ts.map