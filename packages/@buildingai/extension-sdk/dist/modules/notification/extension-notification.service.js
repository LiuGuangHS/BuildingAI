"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExtensionNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionNotificationService = void 0;
const modules_1 = require("@buildingai/core/modules");
const modules_2 = require("@buildingai/core/modules");
const common_1 = require("@nestjs/common");
const DEFAULT_NOTIFICATION_CHANNELS = ["in_app", "web_push"];
let ExtensionNotificationService = ExtensionNotificationService_1 = class ExtensionNotificationService {
    notificationPort;
    logger = new common_1.Logger(ExtensionNotificationService_1.name);
    constructor(notificationPort) {
        this.notificationPort = notificationPort;
    }
    async registerScenes(extensionIdOrScenes, maybeScenes) {
        const resolvedExtensionId = this.resolveExtensionId();
        const extensionId = typeof extensionIdOrScenes === "string"
            ? this.assertExplicitExtensionId(resolvedExtensionId, extensionIdOrScenes)
            : resolvedExtensionId;
        const scenes = typeof extensionIdOrScenes === "string" ? maybeScenes : extensionIdOrScenes;
        if (!scenes?.length)
            return;
        if (!this.notificationPort) {
            this.logger.warn(`Notification scenes skipped for ${extensionId}: platform notification service is not available`);
            return;
        }
        const normalizedScenes = scenes.map((scene) => this.normalizeScene(extensionId, scene));
        await this.notificationPort.registerScenes(extensionId, normalizedScenes);
    }
    async notifyUser(input) {
        const extensionId = this.resolveExtensionId();
        const normalizedInput = this.normalizeNotification(extensionId, input);
        if (!this.notificationPort) {
            this.logger.warn(`Notification skipped for ${normalizedInput.sceneCode}: platform notification service is not available`);
            return { skipped: true, reason: "NOTIFICATION_PORT_UNAVAILABLE" };
        }
        try {
            return await this.notificationPort.notifyUser(extensionId, normalizedInput);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Notification skipped for ${normalizedInput.sceneCode}: ${message}`);
            return { skipped: true, reason: message };
        }
    }
    assertExplicitExtensionId(resolvedExtensionId, explicitExtensionId) {
        if (explicitExtensionId !== resolvedExtensionId) {
            throw new Error(`Notification extensionId "${explicitExtensionId}" does not match caller extension "${resolvedExtensionId}"`);
        }
        return explicitExtensionId;
    }
    normalizeScene(extensionId, scene) {
        this.assertNamespacedScene(extensionId, scene.sceneCode);
        return {
            ...scene,
            channels: scene.channels?.length ? scene.channels : DEFAULT_NOTIFICATION_CHANNELS,
        };
    }
    normalizeNotification(extensionId, input) {
        this.assertNamespacedScene(extensionId, input.sceneCode);
        const sourceType = input.sourceType || "event";
        const sourceId = input.sourceId || input.dedupeKey || Date.now().toString();
        return {
            ...input,
            type: input.type || extensionId,
            sourceType,
            sourceId,
            dedupeKey: input.dedupeKey ||
                `${extensionId}:${input.sceneCode}:${sourceType}:${sourceId}`,
            data: {
                ...(input.data || {}),
                extensionId,
            },
        };
    }
    assertNamespacedScene(extensionId, sceneCode) {
        if (!sceneCode.startsWith(`${extensionId}.`)) {
            throw new Error(`Notification sceneCode "${sceneCode}" must start with "${extensionId}."`);
        }
    }
    resolveExtensionId() {
        const extensionId = (0, modules_2.getExtensionIdentifierFromStack)(["/build/modules/", "/src/api/modules/"]);
        if (!extensionId) {
            throw new Error("Extension notification requires an explicit extensionId");
        }
        return extensionId;
    }
};
exports.ExtensionNotificationService = ExtensionNotificationService;
exports.ExtensionNotificationService = ExtensionNotificationService = ExtensionNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(modules_1.EXTENSION_NOTIFICATION_PORT)),
    __metadata("design:paramtypes", [Object])
], ExtensionNotificationService);
