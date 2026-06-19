import {
    Notification,
    NotificationDelivery,
    NotificationScene,
    User,
} from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { FindOptionsWhere, ILike, IsNull, Not, Repository } from "@buildingai/db/typeorm";
import { DictService, UserDictService } from "@buildingai/dict";
import { HttpErrorFactory } from "@buildingai/errors";
import type {
    ExtensionNotificationPort,
    NotifyUserInput,
    RegisterNotificationSceneInput,
} from "@buildingai/core/modules";
import { WechatOaService } from "@common/modules/wechat/services/wechatoa.service";
import { Injectable, Logger } from "@nestjs/common";

import {
    CreateBusinessNotificationDto,
    CreateNotificationDto,
    QueryNotificationDeliveryDto,
    QueryNotificationDto,
    TestNotificationSceneDto,
    UpdateNotificationSceneDto,
    UpdateNotificationPreferencesDto,
} from "../dto/notification.dto";
import { WebPushService } from "./web-push.service";

type NotificationChannel = "in_app" | "web_push" | "wechat_oa_template" | "sms";

type SceneSeed = {
    sceneCode: string;
    name: string;
    description: string;
    level: string;
    channels: NotificationChannel[];
    titleTemplate: string;
    contentTemplate: string;
    linkUrlTemplate?: string;
};

const DEFAULT_SCENES: SceneSeed[] = [
    {
        sceneCode: "system.test",
        name: "测试通知",
        description: "用于验证站内通知、浏览器通知和公众号模板消息是否可用。",
        level: "info",
        channels: ["in_app", "web_push"],
        titleTemplate: "{{siteName}} 通知测试",
        contentTemplate: "如果你收到了这条消息，说明应用通知已经可以使用。",
        linkUrlTemplate: "/",
    },
    {
        sceneCode: "echoflow-video.generation.succeeded",
        name: "视频生成完成",
        description: "用户发起的视频生成任务处理成功。",
        level: "success",
        channels: ["in_app", "web_push", "wechat_oa_template"],
        titleTemplate: "视频生成完成",
        contentTemplate: "{{taskName}} 已处理完成，可前往查看结果。",
    },
    {
        sceneCode: "echoflow-video.generation.failed",
        name: "视频生成失败",
        description: "用户发起的视频生成任务处理失败。",
        level: "error",
        channels: ["in_app", "web_push", "wechat_oa_template"],
        titleTemplate: "视频生成失败",
        contentTemplate: "{{taskName}} 处理失败，{{reason}}",
    },
    {
        sceneCode: "billing.refunded",
        name: "失败退款完成",
        description: "付费任务失败后已退回积分。",
        level: "warning",
        channels: ["in_app", "web_push", "wechat_oa_template"],
        titleTemplate: "积分已退回",
        contentTemplate: "{{taskName}} 处理失败，已退回 {{amount}} 积分。",
    },
];

const NOTIFICATION_PREFERENCES_GROUP = "notification";
const NOTIFICATION_PREFERENCES_KEY = "preferences";

type NotificationPreferences = {
    disabledScenes: string[];
};

function normalizeChannels(channels?: string[] | null): NotificationChannel[] {
    const allowed = new Set<NotificationChannel>([
        "in_app",
        "web_push",
        "wechat_oa_template",
        "sms",
    ]);
    return (channels || [])
        .filter((channel): channel is NotificationChannel => allowed.has(channel as NotificationChannel));
}

function normalizeSceneChannels(channels?: string[] | null) {
    const normalized = normalizeChannels(channels);
    if (!normalized.length) {
        throw HttpErrorFactory.badRequest("通知场景至少需要启用一个渠道");
    }
    return normalized;
}

function normalizeNotificationLinkUrl(linkUrl?: string | null) {
    const trimmed = linkUrl?.trim();
    if (!trimmed) return null;
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
        throw HttpErrorFactory.badRequest("通知跳转链接包含非法字符");
    }
    if (trimmed.startsWith("/")) {
        if (trimmed.startsWith("//")) {
            throw HttpErrorFactory.badRequest("通知跳转链接不能使用协议相对地址");
        }
        return trimmed;
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw HttpErrorFactory.badRequest("通知跳转链接格式无效");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw HttpErrorFactory.badRequest("通知跳转链接仅支持 HTTP 或 HTTPS");
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest("通知跳转链接不能包含凭据");
    }
    return url.toString();
}

function normalizeNotificationLinkTemplate(template?: string | null) {
    const trimmed = template?.trim();
    if (!trimmed) return null;
    if (!trimmed.includes("{{")) {
        normalizeNotificationLinkUrl(trimmed);
        return trimmed;
    }

    const sampleUrl = trimmed.replace(/\{\{\s*[\w.]+\s*\}\}/g, "placeholder");
    try {
        normalizeNotificationLinkUrl(sampleUrl);
    } catch (error) {
        if (!/^\{\{\s*[\w.]+\s*\}\}$/.test(trimmed)) {
            throw error;
        }
    }
    return trimmed;
}

function renderTemplate(template: string | null | undefined, payload: Record<string, unknown>) {
    if (!template) return "";
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
        const value = key.split(".").reduce<unknown>((acc, part) => {
            if (acc && typeof acc === "object") {
                return (acc as Record<string, unknown>)[part];
            }
            return undefined;
        }, payload);
        return value === undefined || value === null ? "" : String(value);
    });
}

function mapWechatTemplateData(
    fields: unknown,
    payload: Record<string, unknown>,
): Record<string, { value: string }> {
    if (!fields || typeof fields !== "object") return {};

    return Object.entries(fields as Record<string, unknown>).reduce<Record<string, { value: string }>>(
        (result, [field, template]) => {
            result[field] = {
                value: renderTemplate(String(template ?? ""), payload),
            };
            return result;
        },
        {},
    );
}

function isUniqueViolation(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}

@Injectable()
export class NotificationService implements ExtensionNotificationPort {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
        @InjectRepository(NotificationScene)
        private readonly notificationSceneRepository: Repository<NotificationScene>,
        @InjectRepository(NotificationDelivery)
        private readonly notificationDeliveryRepository: Repository<NotificationDelivery>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly webPushService: WebPushService,
        private readonly dictService: DictService,
        private readonly userDictService: UserDictService,
        private readonly wechatOaService: WechatOaService,
    ) {}

    async create(dto: CreateNotificationDto) {
        const notification = await this.createBusinessNotification({
            userId: dto.userId,
            title: dto.title,
            content: dto.content,
            type: dto.type,
            extensionId: dto.extensionId,
            sceneCode: dto.sceneCode || dto.type,
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            dedupeKey: dto.dedupeKey,
            level: dto.level,
            linkUrl: dto.linkUrl,
            data: dto.data,
        });

        if (!notification) {
            throw HttpErrorFactory.badRequest("通知场景已停用");
        }

        return notification;
    }

    async createBusinessNotification(dto: CreateBusinessNotificationDto) {
        const sceneCode = dto.sceneCode || dto.type || "system";
        const scene = await this.getScene(sceneCode);
        if (scene && !scene.isEnabled) {
            return null;
        }
        if (scene?.userConfigurable && await this.isSceneDisabledForUser(dto.userId, scene.sceneCode)) {
            return null;
        }
        const extensionId = dto.extensionId || scene?.extensionId || null;
        const requestedChannels: string[] = dto.channels || scene?.channels || ["in_app", "web_push"];
        const channels = normalizeSceneChannels(requestedChannels);
        const siteName = await this.getSiteName();
        const data = {
            ...(dto.data || {}),
            siteName,
            extensionId,
            sceneCode,
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            dedupeKey: dto.dedupeKey,
        };

        if (dto.dedupeKey) {
            const existing = await this.notificationRepository
                .createQueryBuilder("notification")
                .where("notification.user_id = :userId", { userId: dto.userId })
                .andWhere(
                    "(notification.dedupe_key = :dedupeKey OR notification.data ->> 'dedupeKey' = :dedupeKey)",
                    { dedupeKey: dto.dedupeKey },
                )
                .getOne();
            if (existing) {
                return existing;
            }
        }

        const title =
            dto.title || renderTemplate(scene?.titleTemplate, data) || `${siteName} 通知`;
        const content = dto.content || renderTemplate(scene?.contentTemplate, data) || null;
        const linkUrl = normalizeNotificationLinkUrl(
            dto.linkUrl || renderTemplate(scene?.linkUrlTemplate, data),
        );
        const notificationType = dto.type || extensionId || (sceneCode.length <= 32 ? sceneCode : "business");
        let notification: Notification;
        try {
            notification = await this.notificationRepository.save(
                this.notificationRepository.create({
                    userId: dto.userId,
                    title,
                    content,
                    type: notificationType,
                    extensionId,
                    sceneCode,
                    sourceType: dto.sourceType || null,
                    sourceId: dto.sourceId || null,
                    dedupeKey: dto.dedupeKey || null,
                    level: dto.level || scene?.level || "info",
                    linkUrl,
                    data,
                }),
            );
        } catch (error) {
            if (dto.dedupeKey && isUniqueViolation(error)) {
                const existing = await this.findExistingByDedupeKey(dto.userId, dto.dedupeKey);
                if (existing) return existing;
            }
            throw error;
        }

        await Promise.all(
            channels.map((channel) =>
                this.createAndDispatchDelivery(channel, notification, scene, data),
            ),
        );

        return notification;
    }

    async registerScenes(extensionId: string, scenes: RegisterNotificationSceneInput[]) {
        await this.ensureDefaultScenes();
        for (const scene of scenes) {
            if (!scene.sceneCode.startsWith(`${extensionId}.`)) {
                throw HttpErrorFactory.badRequest("插件通知场景编码必须带插件命名空间");
            }

            const existing = await this.notificationSceneRepository.findOne({
                where: { sceneCode: scene.sceneCode },
            });
            const payload = {
                sceneCode: scene.sceneCode,
                name: scene.name,
                description: scene.description ?? null,
                extensionId,
                level: scene.level || "info",
                channels: normalizeSceneChannels(scene.channels?.length ? scene.channels : ["in_app", "web_push"]),
                titleTemplate: scene.titleTemplate,
                contentTemplate: scene.contentTemplate ?? null,
                linkUrlTemplate: normalizeNotificationLinkTemplate(scene.linkUrlTemplate),
                wechatTemplate: scene.wechatTemplate ?? {},
                userConfigurable: scene.userConfigurable ?? true,
            };

            if (existing) {
                await this.notificationSceneRepository.save({
                    ...existing,
                    ...payload,
                    isEnabled: existing.isEnabled,
                });
                continue;
            }

            await this.notificationSceneRepository.save(
                this.notificationSceneRepository.create({
                    ...payload,
                    isEnabled: true,
                }),
            );
        }
    }

    async notifyUser(extensionId: string, input: NotifyUserInput) {
        if (!input.sceneCode.startsWith(`${extensionId}.`)) {
            throw HttpErrorFactory.badRequest("插件通知场景编码必须带插件命名空间");
        }

        const notification = await this.createBusinessNotification({
            userId: input.userId,
            title: input.title,
            content: input.content ?? undefined,
            type: input.type || extensionId,
            level: input.level,
            linkUrl: input.linkUrl ?? undefined,
            extensionId,
            data: {
                ...(input.data || {}),
                extensionId,
            },
            sceneCode: input.sceneCode,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            dedupeKey:
                input.dedupeKey ||
                `${extensionId}:${input.sceneCode}:${input.sourceType || "event"}:${input.sourceId || "unknown"}`,
            channels: input.channels,
        });

        if (!notification) {
            return { skipped: true, reason: "SCENE_DISABLED" };
        }

        return { notificationId: notification.id };
    }

    async list(userId: string, query: QueryNotificationDto) {
        const page = Number(query.page || 1);
        const pageSize = Math.min(Number(query.pageSize || 15), 50);
        const where: Record<string, unknown> = { userId };

        if (query.type) {
            where.type = query.type;
        }

        if (query.readStatus === "read") {
            where.readAt = Not(IsNull());
        }

        if (query.readStatus === "unread") {
            where.readAt = IsNull();
        }

        const [items, total] = await this.notificationRepository.findAndCount({
            where,
            order: { createdAt: "DESC" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return { items, total, page, pageSize };
    }

    async unreadCount(userId: string) {
        const count = await this.notificationRepository.count({
            where: { userId, readAt: IsNull() },
        });
        return { count };
    }

    async markRead(userId: string, id: string) {
        const notification = await this.notificationRepository.findOne({ where: { id, userId } });
        if (!notification) {
            throw HttpErrorFactory.notFound("通知不存在");
        }

        if (!notification.readAt) {
            notification.readAt = new Date();
            await this.notificationRepository.save(notification);
        }

        return notification;
    }

    async markAllRead(userId: string) {
        await this.notificationRepository.update(
            { userId, readAt: IsNull() },
            { readAt: new Date() },
        );
        return { success: true };
    }

    async createTestNotification(userId: string) {
        return this.createBusinessNotification({
            userId,
            sceneCode: "system.test",
            type: "test",
            level: "info",
            linkUrl: "/",
            dedupeKey: `system.test:${userId}:${Date.now()}`,
        });
    }

    async getUserPreferences(userId: string) {
        const [scenes, preferences] = await Promise.all([
            this.listScenes(),
            this.getStoredUserPreferences(userId),
        ]);
        const configurableScenes = scenes
            .filter((scene) => scene.userConfigurable)
            .map((scene) => ({
                sceneCode: scene.sceneCode,
                name: scene.name,
                description: scene.description,
                enabled: !preferences.disabledScenes.includes(scene.sceneCode),
                channels: scene.channels,
            }));

        return {
            disabledScenes: preferences.disabledScenes,
            scenes: configurableScenes,
        };
    }

    async updateUserPreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
        const scenes = await this.listScenes();
        const configurableSceneCodes = new Set(
            scenes.filter((scene) => scene.userConfigurable).map((scene) => scene.sceneCode),
        );
        const disabledScenes = [...new Set(dto.disabledScenes || [])].filter((sceneCode) =>
            configurableSceneCodes.has(sceneCode),
        );
        const preferences = { disabledScenes };
        await this.userDictService.set(userId, NOTIFICATION_PREFERENCES_KEY, preferences, {
            group: NOTIFICATION_PREFERENCES_GROUP,
            description: "用户通知偏好",
        });
        return this.getUserPreferences(userId);
    }

    async listScenes() {
        await this.ensureDefaultScenes();
        const scenes = await this.notificationSceneRepository.find({
            order: { createdAt: "ASC" },
        });
        return scenes;
    }

    async updateScene(sceneCode: string, dto: UpdateNotificationSceneDto) {
        await this.ensureDefaultScenes();
        const scene = await this.notificationSceneRepository.findOne({ where: { sceneCode } });
        if (!scene) {
            throw HttpErrorFactory.notFound("通知场景不存在");
        }

        Object.assign(scene, {
            ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
            ...(dto.level !== undefined ? { level: dto.level } : {}),
            ...(dto.channels !== undefined ? { channels: normalizeSceneChannels(dto.channels) } : {}),
            ...(dto.titleTemplate !== undefined ? { titleTemplate: dto.titleTemplate } : {}),
            ...(dto.contentTemplate !== undefined ? { contentTemplate: dto.contentTemplate } : {}),
            ...(dto.linkUrlTemplate !== undefined
                ? { linkUrlTemplate: normalizeNotificationLinkTemplate(dto.linkUrlTemplate) }
                : {}),
            ...(dto.wechatTemplate !== undefined ? { wechatTemplate: dto.wechatTemplate } : {}),
            ...(dto.userConfigurable !== undefined
                ? { userConfigurable: dto.userConfigurable }
                : {}),
        });

        return this.notificationSceneRepository.save(scene);
    }

    async listDeliveries(query: QueryNotificationDeliveryDto) {
        const page = Number(query.page || 1);
        const pageSize = Math.min(Number(query.pageSize || 15), 100);
        const where: FindOptionsWhere<NotificationDelivery> = {};

        if (query.sceneCode) where.sceneCode = ILike(`%${query.sceneCode}%`);
        if (query.extensionId) where.extensionId = query.extensionId;
        if (query.channel) where.channel = query.channel;
        if (query.status) where.status = query.status;
        if (query.userId) where.userId = query.userId;

        const [items, total] = await this.notificationDeliveryRepository.findAndCount({
            where,
            order: { createdAt: "DESC" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return { items, total, page, pageSize };
    }

    async getChannelStatus() {
        const [webPushSubscriptions, wechatConfigured] = await Promise.all([
            this.webPushService.countEnabledSubscriptions(),
            this.getWechatConfigured(),
        ]);

        return [
            {
                channel: "in_app",
                name: "站内通知",
                enabled: true,
                ready: true,
                description: "所有通知都会优先进入站内通知中心。",
            },
            {
                channel: "web_push",
                name: "浏览器通知",
                enabled: true,
                ready: true,
                description: webPushSubscriptions > 0
                    ? `当前有 ${webPushSubscriptions} 个有效浏览器订阅。`
                    : "需要用户授权浏览器通知。",
            },
            {
                channel: "wechat_oa_template",
                name: "微信公众号模板消息",
                enabled: true,
                ready: wechatConfigured,
                description: wechatConfigured
                    ? "公众号基础配置已存在，具体场景还需配置模板 ID。"
                    : "请先在渠道配置中完善公众号 AppID、AppSecret、Token。",
            },
            {
                channel: "sms",
                name: "短信通知",
                enabled: false,
                ready: false,
                description: "业务短信通知预留，当前验证码短信仍由短信配置维护。",
            },
        ];
    }

    async testScene(sceneCode: string, dto: TestNotificationSceneDto, fallbackUserId: string) {
        const scene = await this.getScene(sceneCode);
        if (!scene) {
            throw HttpErrorFactory.notFound("通知场景不存在");
        }
        if (!scene.isEnabled) {
            throw HttpErrorFactory.badRequest("通知场景已停用");
        }

        const userId = dto.userId || fallbackUserId;
        return this.createBusinessNotification({
            userId,
            sceneCode,
            dedupeKey: `test:${sceneCode}:${userId}:${Date.now()}`,
            channels: dto.channels,
            data: {
                taskName: "测试任务",
                reason: "这是一条测试通知",
                amount: "1",
            },
        });
    }

    private async getSiteName() {
        return this.dictService.get<string>("name", "BuildingAI", "webinfo");
    }

    private async getScene(sceneCode: string) {
        await this.ensureDefaultScenes();
        return this.notificationSceneRepository.findOne({
            where: { sceneCode },
        });
    }

    private findExistingByDedupeKey(userId: string, dedupeKey: string) {
        return this.notificationRepository
            .createQueryBuilder("notification")
            .where("notification.user_id = :userId", { userId })
            .andWhere(
                "(notification.dedupe_key = :dedupeKey OR notification.data ->> 'dedupeKey' = :dedupeKey)",
                { dedupeKey },
            )
            .getOne();
    }

    private async getStoredUserPreferences(userId: string): Promise<NotificationPreferences> {
        const preferences = await this.userDictService.get<Partial<NotificationPreferences>>(
            userId,
            NOTIFICATION_PREFERENCES_KEY,
            { disabledScenes: [] },
            NOTIFICATION_PREFERENCES_GROUP,
        );
        return {
            disabledScenes: Array.isArray(preferences?.disabledScenes)
                ? preferences.disabledScenes.filter((item): item is string => typeof item === "string")
                : [],
        };
    }

    private async isSceneDisabledForUser(userId: string, sceneCode: string) {
        const preferences = await this.getStoredUserPreferences(userId);
        return preferences.disabledScenes.includes(sceneCode);
    }

    private async ensureDefaultScenes() {
        for (const seed of DEFAULT_SCENES) {
            const existing = await this.notificationSceneRepository.findOne({
                where: { sceneCode: seed.sceneCode },
            });
            if (existing) continue;

            await this.notificationSceneRepository.save(
                this.notificationSceneRepository.create({
                    ...seed,
                    userConfigurable: true,
                    wechatTemplate: {},
                }),
            );
        }
    }

    private async createAndDispatchDelivery(
        channel: NotificationChannel,
        notification: Notification,
        scene: NotificationScene | null,
        data: Record<string, unknown>,
    ) {
        const delivery = await this.notificationDeliveryRepository.save(
            this.notificationDeliveryRepository.create({
                notificationId: notification.id,
                userId: notification.userId,
                sceneCode: notification.sceneCode || String(data.sceneCode || notification.type),
                extensionId: notification.extensionId || null,
                sourceType: notification.sourceType || String(data.sourceType || "") || null,
                sourceId: notification.sourceId || String(data.sourceId || "") || null,
                channel,
                status: channel === "in_app" ? "sent" : "pending",
                attempts: channel === "in_app" ? 1 : 0,
                sentAt: channel === "in_app" ? new Date() : null,
                payload: {
                    title: notification.title,
                    linkUrl: notification.linkUrl,
                    sourceType: data.sourceType,
                    sourceId: data.sourceId,
                },
            }),
        );

        if (channel === "in_app") return delivery;

        try {
            if (channel === "web_push") {
                const result = await this.webPushService.sendNotification(notification.userId, {
                    title: notification.title,
                    body: notification.content,
                    url: notification.linkUrl,
                    notificationId: notification.id,
                });
                if (result.sentCount > 0) {
                    return this.markDeliverySent(delivery, null, {
                        ...delivery.payload,
                        webPush: result,
                    });
                }
                if (result.subscriptionCount === 0) {
                    return this.markDeliverySkipped(
                        delivery,
                        "WEB_PUSH_NOT_SUBSCRIBED",
                        "用户未开启浏览器通知",
                        {
                            ...delivery.payload,
                            webPush: result,
                        },
                    );
                }
                return this.markDeliveryFailed(
                    delivery,
                    new Error(result.failures[0]?.message || "Web Push 发送失败"),
                    {
                        ...delivery.payload,
                        webPush: result,
                    },
                );
            }

            if (channel === "wechat_oa_template") {
                return this.dispatchWechatTemplate(delivery, notification, scene, data);
            }

            return this.markDeliverySkipped(delivery, "CHANNEL_RESERVED", "渠道暂未启用");
        } catch (error) {
            this.logger.warn(error instanceof Error ? error.message : String(error));
            return this.markDeliveryFailed(delivery, error);
        }
    }

    private async dispatchWechatTemplate(
        delivery: NotificationDelivery,
        notification: Notification,
        scene: NotificationScene | null,
        data: Record<string, unknown>,
    ) {
        const user = await this.userRepository.findOne({ where: { id: notification.userId } });
        if (!user?.openid) {
            return this.markDeliverySkipped(delivery, "WECHAT_NOT_BOUND", "用户未绑定微信公众号");
        }

        const template = scene?.wechatTemplate || {};
        const templateId = typeof template.templateId === "string" ? template.templateId : "";
        if (!templateId) {
            return this.markDeliverySkipped(delivery, "WECHAT_TEMPLATE_MISSING", "未配置微信模板ID");
        }

        const fields = mapWechatTemplateData(template.fields, {
            ...data,
            title: notification.title,
            content: notification.content,
        });
        const result = await this.wechatOaService.sendOfficialAccountTemplateMessage({
            touser: user.openid,
            template_id: templateId,
            url: normalizeNotificationLinkUrl(
                typeof template.url === "string"
                    ? renderTemplate(template.url, data)
                    : notification.linkUrl,
            ) || undefined,
            data: fields,
        });

        if (result.errcode !== 0) {
            throw new Error(`微信模板消息发送失败: ${result.errcode} ${result.errmsg || ""}`);
        }

        return this.markDeliverySent(delivery, result.msgid ? String(result.msgid) : null);
    }

    private markDeliverySent(
        delivery: NotificationDelivery,
        providerMessageId?: string | null,
        payload?: Record<string, unknown> | null,
    ) {
        return this.notificationDeliveryRepository.save({
            ...delivery,
            status: "sent",
            attempts: delivery.attempts + 1,
            providerMessageId: providerMessageId || delivery.providerMessageId,
            errorCode: null,
            errorMessage: null,
            payload: payload ?? delivery.payload,
            sentAt: new Date(),
        });
    }

    private markDeliverySkipped(
        delivery: NotificationDelivery,
        errorCode: string,
        errorMessage: string,
        payload?: Record<string, unknown> | null,
    ) {
        return this.notificationDeliveryRepository.save({
            ...delivery,
            status: "skipped",
            errorCode,
            errorMessage,
            payload: payload ?? delivery.payload,
        });
    }

    private markDeliveryFailed(
        delivery: NotificationDelivery,
        error: unknown,
        payload?: Record<string, unknown> | null,
    ) {
        return this.notificationDeliveryRepository.save({
            ...delivery,
            status: "failed",
            attempts: delivery.attempts + 1,
            errorCode: error instanceof Error ? error.name : "DELIVERY_FAILED",
            errorMessage: error instanceof Error ? error.message : String(error),
            payload: payload ?? delivery.payload,
        });
    }

    private async getWechatConfigured() {
        try {
            const appId = await this.dictService.get<string>("appId", "", "wxoaconfig");
            const appSecret = await this.dictService.get<string>("appSecret", "", "wxoaconfig");
            return Boolean(appId && appSecret);
        } catch {
            return false;
        }
    }
}
