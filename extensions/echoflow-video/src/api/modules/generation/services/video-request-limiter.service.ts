import { RedisService } from "@buildingai/cache";
import { HttpError, HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

const LIMIT_WINDOWS = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
] as const;

@Injectable()
export class VideoRequestLimiterService {
    private readonly logger = new Logger(VideoRequestLimiterService.name);

    constructor(private readonly redisService: RedisService) {}

    async assertAllowed(action: "generation" | "prompt-optimization", userId: string) {
        for (const window of LIMIT_WINDOWS) {
            const key = `echoflow-video:rate:${action}:${window.suffix}:${userId}`;
            try {
                const count = await this.redisService.incr(key);
                if (count === 1) {
                    await this.redisService.expire(key, window.ttlSeconds);
                }
                if (count > window.limit) {
                    throw HttpErrorFactory.tooManyRequests("请求过于频繁，请稍后重试", {
                        action,
                        retryAfterSeconds: await this.redisService.ttl(key),
                    });
                }
            } catch (error) {
                if (error instanceof HttpError) {
                    throw error;
                }
                this.logger.warn(
                    `Video request limiter skipped for ${action}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
    }
}
