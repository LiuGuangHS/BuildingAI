import {
    EXTENSION_NOTIFICATION_PORT,
    type ExtensionNotificationPort,
    type NotifyUserInput,
    type NotifyUserResult,
    type RegisterNotificationSceneInput,
} from "@buildingai/core/modules";
import { getExtensionIdentifierFromStack } from "@buildingai/core/modules";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

export type ExtensionRegisterNotificationSceneInput = RegisterNotificationSceneInput;

export type ExtensionNotifyUserInput = NotifyUserInput;

const DEFAULT_NOTIFICATION_CHANNELS: NonNullable<RegisterNotificationSceneInput["channels"]> = ["in_app", "web_push"];

@Injectable()
export class ExtensionNotificationService {
    private readonly logger = new Logger(ExtensionNotificationService.name);

    constructor(
        @Optional()
        @Inject(EXTENSION_NOTIFICATION_PORT)
        private readonly notificationPort?: ExtensionNotificationPort,
    ) {}

    async registerScenes(
        extensionIdOrScenes: string | RegisterNotificationSceneInput[],
        maybeScenes?: RegisterNotificationSceneInput[],
    ) {
        const resolvedExtensionId = this.tryResolveExtensionId();
        const hasExplicitExtensionId = typeof extensionIdOrScenes === "string";
        const extensionId = hasExplicitExtensionId
            ? this.assertExplicitExtensionId(extensionIdOrScenes, resolvedExtensionId)
            : this.requireResolvedExtensionId(resolvedExtensionId);
        const scenes = hasExplicitExtensionId ? maybeScenes : extensionIdOrScenes;

        if (!scenes?.length) return;
        if (!this.notificationPort) {
            this.logger.warn(
                `Notification scenes skipped for ${extensionId}: platform notification service is not available`,
            );
            return;
        }
        const normalizedScenes = scenes.map((scene) =>
            this.normalizeScene(extensionId, scene),
        );
        await this.notificationPort.registerScenes(extensionId, normalizedScenes);
    }

    async notifyUser(input: ExtensionNotifyUserInput): Promise<NotifyUserResult> {
        const extensionId = this.resolveExtensionId();
        const normalizedInput = this.normalizeNotification(extensionId, input);

        if (!this.notificationPort) {
            this.logger.warn(
                `Notification skipped for ${normalizedInput.sceneCode}: platform notification service is not available`,
            );
            return { skipped: true, reason: "NOTIFICATION_PORT_UNAVAILABLE" };
        }

        try {
            return await this.notificationPort.notifyUser(extensionId, normalizedInput);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Notification skipped for ${normalizedInput.sceneCode}: ${message}`,
            );
            return { skipped: true, reason: message };
        }
    }

    private assertExplicitExtensionId(explicitExtensionId: string, resolvedExtensionId: string | null) {
        if (resolvedExtensionId && explicitExtensionId !== resolvedExtensionId) {
            throw new Error(
                `Notification extensionId "${explicitExtensionId}" does not match caller extension "${resolvedExtensionId}"`,
            );
        }
        return explicitExtensionId;
    }

    private normalizeScene(extensionId: string, scene: RegisterNotificationSceneInput): RegisterNotificationSceneInput {
        this.assertNamespacedScene(extensionId, scene.sceneCode);
        return {
            ...scene,
            channels: scene.channels?.length ? scene.channels : DEFAULT_NOTIFICATION_CHANNELS,
        };
    }

    private normalizeNotification(
        extensionId: string,
        input: ExtensionNotifyUserInput,
    ): NotifyUserInput {
        this.assertNamespacedScene(extensionId, input.sceneCode);
        const sourceType = input.sourceType || "event";
        const sourceId = input.sourceId || input.dedupeKey || Date.now().toString();
        return {
            ...input,
            type: input.type || extensionId,
            sourceType,
            sourceId,
            dedupeKey:
                input.dedupeKey ||
                `${extensionId}:${input.sceneCode}:${sourceType}:${sourceId}`,
            data: {
                ...(input.data || {}),
                extensionId,
            },
        };
    }

    private assertNamespacedScene(extensionId: string, sceneCode: string) {
        if (!sceneCode.startsWith(`${extensionId}.`)) {
            throw new Error(
                `Notification sceneCode "${sceneCode}" must start with "${extensionId}."`,
            );
        }
    }

    private requireResolvedExtensionId(extensionId: string | null) {
        if (!extensionId) {
            throw new Error("Extension notification requires an explicit extensionId");
        }
        return extensionId;
    }

    private resolveExtensionId() {
        return this.requireResolvedExtensionId(this.tryResolveExtensionId());
    }

    private tryResolveExtensionId() {
        const extensionId = getExtensionIdentifierFromStack(["/build/modules/", "/src/api/modules/"]);
        return extensionId;
    }
}
