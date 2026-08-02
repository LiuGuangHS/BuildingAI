import { PushSubscription } from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import webPush from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";

import { SubscribePushDto, UnsubscribePushDto } from "../dto/notification.dto";
import { assertSafePushEndpoint } from "./web-push-endpoint.util";

export type WebPushNotificationPayload = {
    title: string;
    body?: string | null;
    url?: string | null;
    icon?: string | null;
    notificationId?: string;
};

export type WebPushSendResult = {
    subscriptionCount: number;
    sentCount: number;
    failedCount: number;
    disabledCount: number;
    failures: Array<{
        endpoint: string;
        statusCode?: number;
        message: string;
    }>;
};

type VapidKeys = {
    publicKey: string;
    privateKey: string;
};

type LegacyVapidKeys = {
    publicKey?: string;
    privateJwk?: {
        d?: string;
    };
};

const DICT_GROUP = "notification";
const VAPID_KEYS_KEY = "webPushVapidKeys";
const MAX_PUSH_USER_AGENT_LENGTH = 512;

function generateVapidKeys(): VapidKeys {
    return webPush.generateVAPIDKeys();
}

function toWebPushSubscription(subscription: PushSubscription): WebPushSubscription {
    return {
        endpoint: subscription.endpoint,
        keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
        },
    };
}

function describePushEndpoint(endpoint: string) {
    let host = "unknown";
    try {
        host = new URL(endpoint).hostname.trim().toLowerCase().replace(/\.$/, "") || "unknown";
    } catch {
        // Keep a stable fingerprint for malformed legacy records without storing the raw endpoint.
    }
    const fingerprint = createHash("sha256").update(endpoint).digest("hex").slice(0, 12);
    return `${host}#${fingerprint}`;
}

function normalizePushErrorMessage(error: unknown, endpoint: string) {
    const message = (error instanceof Error ? error.message : String(error))
        .replaceAll(endpoint, describePushEndpoint(endpoint));
    if (!message) return "Web Push 发送失败";
    if (message.length > 300) return `${message.slice(0, 300)}...`;
    return message;
}

function normalizeVapidSubject(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    if (/^mailto:[^@\s]+@[^@\s]+$/i.test(trimmed)) {
        return trimmed;
    }

    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (url.username || url.password) return null;
        return url.origin;
    } catch {
        return null;
    }
}

@Injectable()
export class WebPushService {
    private readonly logger = new Logger(WebPushService.name);

    constructor(
        @InjectRepository(PushSubscription)
        private readonly pushSubscriptionRepository: Repository<PushSubscription>,
        private readonly dictService: DictService,
    ) {}

    async getPublicKey() {
        const keys = await this.getVapidKeys();
        return { publicKey: keys.publicKey };
    }

    async getStatus(userId: string) {
        const count = await this.pushSubscriptionRepository.count({
            where: { userId, isEnabled: true },
        });

        return {
            enabled: count > 0,
            subscriptionCount: count,
        };
    }

    countEnabledSubscriptions() {
        return this.pushSubscriptionRepository.count({ where: { isEnabled: true } });
    }

    async subscribe(userId: string, dto: SubscribePushDto, userAgent?: string) {
        await assertSafePushEndpoint(dto.endpoint);

        const existing = await this.pushSubscriptionRepository.findOne({
            where: { endpoint: dto.endpoint },
        });

        const payload = {
            userId,
            endpoint: dto.endpoint,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            userAgent: userAgent?.slice(0, MAX_PUSH_USER_AGENT_LENGTH),
            expiresAt: dto.expirationTime || null,
            isEnabled: true,
            failureCount: 0,
            failedAt: null,
        };

        if (existing) {
            if (existing.userId !== userId) {
                throw new ConflictException("Push subscription belongs to another user");
            }
            await this.pushSubscriptionRepository.update(existing.id, payload);
            return { enabled: true };
        }

        await this.pushSubscriptionRepository.save(this.pushSubscriptionRepository.create(payload));
        return { enabled: true };
    }

    async unsubscribe(userId: string, dto: UnsubscribePushDto) {
        if (dto.endpoint) {
            await this.pushSubscriptionRepository.update(
                { userId, endpoint: dto.endpoint },
                { isEnabled: false },
            );
        } else {
            await this.pushSubscriptionRepository.update({ userId }, { isEnabled: false });
        }

        return { enabled: false };
    }

    async sendWakeup(userId: string) {
        const siteName = await this.dictService.get<string>("name", "EchoFlowAI", "webinfo");
        return this.sendNotification(userId, {
            title: siteName,
            body: "任务状态已更新",
            url: "/",
        });
    }

    async sendNotification(userId: string, payload: WebPushNotificationPayload): Promise<WebPushSendResult> {
        const subscriptions = await this.pushSubscriptionRepository.find({
            where: { userId, isEnabled: true },
        });

        const results = await Promise.all(
            subscriptions.map((subscription) => this.sendPush(subscription, payload)),
        );

        return {
            subscriptionCount: subscriptions.length,
            sentCount: results.filter((item) => item.sent).length,
            failedCount: results.filter((item) => !item.sent).length,
            disabledCount: results.filter((item) => item.disabled).length,
            failures: results
                .filter((item) => !item.sent)
                .map((item) => ({
                    endpoint: describePushEndpoint(item.endpoint),
                    statusCode: item.statusCode,
                    message: item.message || "Web Push 发送失败",
                })),
        };
    }

    private async getVapidKeys(): Promise<VapidKeys> {
        const existing = await this.dictService.get<(VapidKeys & LegacyVapidKeys) | null>(
            VAPID_KEYS_KEY,
            null,
            DICT_GROUP,
        );
        if (existing?.publicKey && existing?.privateKey) {
            return existing;
        }
        if (existing?.publicKey && existing?.privateJwk?.d) {
            const migrated = {
                publicKey: existing.publicKey,
                privateKey: existing.privateJwk.d,
            };
            await this.dictService.set(VAPID_KEYS_KEY, migrated, {
                group: DICT_GROUP,
                description: "PWA Web Push VAPID keys",
            });
            return migrated;
        }

        const keys = generateVapidKeys();
        await this.dictService.set(VAPID_KEYS_KEY, keys, {
            group: DICT_GROUP,
            description: "PWA Web Push VAPID keys",
        });
        return keys;
    }

    private async sendPush(subscription: PushSubscription, payload: WebPushNotificationPayload) {
        try {
            await assertSafePushEndpoint(subscription.endpoint);
            const keys = await this.getVapidKeys();
            const vapidSubject = await this.getVapidSubject();
            webPush.setVapidDetails(vapidSubject, keys.publicKey, keys.privateKey);

            await webPush.sendNotification(
                toWebPushSubscription(subscription),
                JSON.stringify(payload),
                {
                    TTL: 2_419_200,
                    timeout: 10_000,
                },
            );

            await this.pushSubscriptionRepository.update(subscription.id, {
                lastUsedAt: new Date(),
                failedAt: null,
                failureCount: 0,
            });
            return {
                endpoint: subscription.endpoint,
                sent: true,
                disabled: false,
            };
        } catch (error) {
            const statusCode =
                typeof error === "object" &&
                error !== null &&
                "statusCode" in error &&
                typeof error.statusCode === "number"
                    ? error.statusCode
                    : null;
            const shouldDisable = statusCode === 404 || statusCode === 410;

            await this.pushSubscriptionRepository.update(subscription.id, {
                isEnabled: shouldDisable ? false : subscription.isEnabled,
                failedAt: new Date(),
                failureCount: subscription.failureCount + 1,
            });
            const message = normalizePushErrorMessage(error, subscription.endpoint);
            this.logger.warn(message);
            return {
                endpoint: subscription.endpoint,
                sent: false,
                disabled: shouldDisable,
                statusCode: statusCode ?? undefined,
                message,
            };
        }
    }

    private async getVapidSubject() {
        const siteUrl = await this.dictService.get<string>("url", "", "webinfo");
        return normalizeVapidSubject(siteUrl)
            || normalizeVapidSubject(process.env.APP_DOMAIN)
            || "mailto:webpush@echoflow.cn";
    }
}
