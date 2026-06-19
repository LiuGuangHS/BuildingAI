import { PushSubscription } from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { isIP } from "node:net";
import webPush from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";

import { SubscribePushDto, UnsubscribePushDto } from "../dto/notification.dto";

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
const VAPID_SUBJECT = "mailto:support@echoflow.com";
const MAX_PUSH_ENDPOINT_LENGTH = 2048;
const MAX_PUSH_USER_AGENT_LENGTH = 512;
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "updates-autopush.stage.mozaws.net",
    "updates-autopush.dev.mozaws.net",
    "web.push.apple.com",
    "api.push.apple.com",
    "wns.windows.com",
    "notify.windows.com",
];

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

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function describePushEndpoint(endpoint: string) {
    let host = "unknown";
    try {
        host = normalizeHostname(new URL(endpoint).hostname) || "unknown";
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

function isPrivateOrReservedIpv4(address: string) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }

    const [a, b, c] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a === 169 && b === 254 ||
        a === 172 && b >= 16 && b <= 31 ||
        a === 192 && b === 0 && c === 0 ||
        a === 192 && b === 168 ||
        a === 198 && (b === 18 || b === 19) ||
        a === 100 && b >= 64 && b <= 127 ||
        a === 192 && b === 0 && c === 2 ||
        a === 198 && b === 51 && c === 100 ||
        a === 203 && b === 0 && c === 113 ||
        a >= 224
    );
}

function isPrivateOrReservedIpv6(address: string) {
    const normalized = address.toLowerCase();
    return (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80:") ||
        normalized.startsWith("ff")
    );
}

function isPrivateOrReservedIp(address: string) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return isPrivateOrReservedIpv4(mapped[1]);
    const family = isIP(address);
    if (family === 4) return isPrivateOrReservedIpv4(address);
    if (family === 6) return isPrivateOrReservedIpv6(address);
    return true;
}

function isAllowedPushEndpointHostname(hostname: string) {
    return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
}

export async function assertSafePushEndpoint(endpoint: string) {
    if (endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址过长");
    }

    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址无效");
    }

    if (url.protocol !== "https:") {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址必须使用 HTTPS");
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能包含凭据");
    }

    const hostname = normalizeHostname(url.hostname);
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
    }
    if (!isAllowedPushEndpointHostname(hostname)) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不是受支持的 Push 服务");
    }
    if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
    }

    let addresses: LookupAddress[];
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址无法解析");
    }
    if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
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
        const siteName = await this.dictService.get<string>("name", "BuildingAI", "webinfo");
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
            webPush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);

            await webPush.sendNotification(
                toWebPushSubscription(subscription),
                JSON.stringify(payload),
                {
                    TTL: 2_419_200,
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
}
