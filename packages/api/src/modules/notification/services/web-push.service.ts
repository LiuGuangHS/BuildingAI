import { PushSubscription } from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { Injectable, Logger } from "@nestjs/common";
import { createPrivateKey, createSign, generateKeyPairSync } from "crypto";
import type { JsonWebKey as NodeJsonWebKey } from "crypto";

import { SubscribePushDto, UnsubscribePushDto } from "../dto/notification.dto";

type VapidKeys = {
    publicKey: string;
    publicJwk: NodeJsonWebKey;
    privateJwk: NodeJsonWebKey;
};

const DICT_GROUP = "notification";
const VAPID_KEYS_KEY = "webPushVapidKeys";
const VAPID_SUBJECT = "mailto:support@echoflow.com";

function base64UrlEncode(input: Buffer | string) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64");
}

function generateVapidKeys(): VapidKeys {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicJwk = pair.publicKey.export({ format: "jwk" }) as NodeJsonWebKey;
    const privateJwk = pair.privateKey.export({ format: "jwk" }) as NodeJsonWebKey;
    const x = base64UrlDecode(publicJwk.x || "");
    const y = base64UrlDecode(publicJwk.y || "");

    return {
        publicKey: base64UrlEncode(Buffer.concat([Buffer.from([4]), x, y])),
        publicJwk,
        privateJwk,
    };
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

    async subscribe(userId: string, dto: SubscribePushDto, userAgent?: string) {
        const existing = await this.pushSubscriptionRepository.findOne({
            where: { endpoint: dto.endpoint },
        });

        const payload = {
            userId,
            endpoint: dto.endpoint,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            userAgent,
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
        const subscriptions = await this.pushSubscriptionRepository.find({
            where: { userId, isEnabled: true },
        });

        await Promise.all(subscriptions.map((subscription) => this.sendEmptyPush(subscription)));
    }

    private async getVapidKeys(): Promise<VapidKeys> {
        const existing = await this.dictService.get<VapidKeys | null>(
            VAPID_KEYS_KEY,
            null,
            DICT_GROUP,
        );
        if (existing?.publicKey && existing?.privateJwk) {
            return existing;
        }

        const keys = generateVapidKeys();
        await this.dictService.set(VAPID_KEYS_KEY, keys, {
            group: DICT_GROUP,
            description: "PWA Web Push VAPID keys",
        });
        return keys;
    }

    private async createVapidAuthorization(endpoint: string) {
        const keys = await this.getVapidKeys();
        const aud = new URL(endpoint).origin;
        const header = base64UrlEncode(JSON.stringify({ alg: "ES256", typ: "JWT" }));
        const payload = base64UrlEncode(
            JSON.stringify({
                aud,
                exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
                sub: VAPID_SUBJECT,
            }),
        );
        const signer = createSign("SHA256");
        signer.update(`${header}.${payload}`);
        signer.end();
        const signature = signer.sign({
            key: createPrivateKey({ key: keys.privateJwk, format: "jwk" }),
            dsaEncoding: "ieee-p1363",
        });
        const token = `${header}.${payload}.${base64UrlEncode(signature)}`;

        return `vapid t=${token}, k=${keys.publicKey}`;
    }

    private async sendEmptyPush(subscription: PushSubscription) {
        try {
            const response = await fetch(subscription.endpoint, {
                method: "POST",
                headers: {
                    Authorization: await this.createVapidAuthorization(subscription.endpoint),
                    TTL: "2419200",
                },
            });

            if (response.status === 404 || response.status === 410) {
                await this.pushSubscriptionRepository.update(subscription.id, {
                    isEnabled: false,
                    failedAt: new Date(),
                    failureCount: subscription.failureCount + 1,
                });
                return;
            }

            if (!response.ok) {
                throw new Error(`Web Push failed: ${response.status} ${response.statusText}`);
            }

            await this.pushSubscriptionRepository.update(subscription.id, {
                lastUsedAt: new Date(),
                failedAt: null,
                failureCount: 0,
            });
        } catch (error) {
            await this.pushSubscriptionRepository.update(subscription.id, {
                failedAt: new Date(),
                failureCount: subscription.failureCount + 1,
            });
            this.logger.warn(error instanceof Error ? error.message : String(error));
        }
    }
}
