import { CacheService } from "@buildingai/cache";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
    /** windowMs → maxRequests */
    private readonly limits: { windowMs: number; max: number }[];

    constructor(
        private readonly cacheService: CacheService,
        limits: { windowMs: number; max: number }[],
    ) {
        this.limits = [...limits].sort((a, b) => a.windowMs - b.windowMs);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            ip?: string;
            user?: { id?: string };
        }>();

        // Identify caller: prefer userId, fallback to IP
        const identifier = request.user?.id ?? request.ip ?? "anonymous";
        const now = Date.now();

        for (const limit of this.limits) {
            const key = `echoflow-video:rate-limit:${identifier}:${limit.windowMs}`;
            let entry = await this.cacheService.get<RateLimitEntry>(key);

            if (!entry || now > entry.resetAt) {
                entry = { count: 1, resetAt: now + limit.windowMs };
                await this.cacheService.set(key, entry, Math.ceil(limit.windowMs / 1000));
                continue;
            }

            entry.count++;
            await this.cacheService.set(
                key,
                entry,
                Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
            );

            if (entry.count > limit.max) {
                const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
                throw HttpErrorFactory.badRequest(
                    `请求过于频繁，请在 ${retryAfterSec} 秒后重试`,
                );
            }
        }

        return true;
    }
}

@Injectable()
export class WebApiRateLimitGuard extends RateLimitGuard {
    constructor(cacheService: CacheService) {
        super(cacheService, [
            { windowMs: 10_000, max: 5 },
            { windowMs: 60_000, max: 20 },
        ]);
    }
}
