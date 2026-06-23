import { HttpError, HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

export interface ExtensionRateLimitRedisPort {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<unknown>;
    ttl(key: string): Promise<number>;
}

export interface ExtensionRateLimitWindow {
    suffix: string;
    ttlSeconds: number;
    limit: number;
}

export interface ExtensionRateLimitOptions {
    namespace: string;
    action: string;
    subject: string;
    windows: ExtensionRateLimitWindow[];
    message?: string;
    failOpen?: boolean;
}

@Injectable()
export class ExtensionRateLimitService {
    private readonly logger = new Logger(ExtensionRateLimitService.name);

    constructor(private readonly redisService: ExtensionRateLimitRedisPort) {}

    async assertAllowed(options: ExtensionRateLimitOptions) {
        const failOpen = options.failOpen !== false;
        for (const window of options.windows) {
            const key = `${options.namespace}:rate:${options.action}:${window.suffix}:${options.subject}`;
            try {
                const count = await this.redisService.incr(key);
                if (count === 1) {
                    await this.redisService.expire(key, window.ttlSeconds);
                }
                if (count > window.limit) {
                    throw HttpErrorFactory.tooManyRequests(options.message ?? "请求过于频繁，请稍后重试", {
                        action: options.action,
                        retryAfterSeconds: await this.redisService.ttl(key),
                    });
                }
            } catch (error) {
                if (error instanceof HttpError) {
                    throw error;
                }
                if (!failOpen) {
                    throw error;
                }
                this.logger.warn(
                    `Extension rate limiter skipped for ${options.namespace}:${options.action}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
    }
}
