import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

/**
 * In-memory sliding-window rate limiter.
 * For production multi-instance deployments, replace with Redis-backed limiter.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
    /** windowMs → maxRequests */
    private readonly limits: { windowMs: number; max: number }[];
    private readonly store = new Map<string, RateLimitEntry>();

    /** Periodic cleanup every 60s to prevent memory leak */
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(limits: { windowMs: number; max: number }[]) {
        this.limits = [...limits].sort((a, b) => a.windowMs - b.windowMs);
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<{
            ip?: string;
            user?: { id?: string };
        }>();

        // Identify caller: prefer userId, fallback to IP
        const identifier = request.user?.id ?? request.ip ?? "anonymous";
        const now = Date.now();

        for (const limit of this.limits) {
            const key = `${identifier}:${limit.windowMs}`;
            let entry = this.store.get(key);

            if (!entry || now > entry.resetAt) {
                entry = { count: 1, resetAt: now + limit.windowMs };
                this.store.set(key, entry);
                this.ensureCleanup();
                continue;
            }

            entry.count++;

            if (entry.count > limit.max) {
                const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
                throw HttpErrorFactory.badRequest(
                    `请求过于频繁，请在 ${retryAfterSec} 秒后重试`,
                );
            }
        }

        return true;
    }

    private ensureCleanup(): void {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store) {
                if (now > entry.resetAt) {
                    this.store.delete(key);
                }
            }
            if (this.store.size === 0 && this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
        }, 60_000);
    }
}

/** Pre-built guard for web API: 10 req/min create, 30 req/min poll */
export const webApiRateLimitGuard = new RateLimitGuard([
    { windowMs: 10_000, max: 5 },   // burst: 5 req / 10s
    { windowMs: 60_000, max: 20 },  // sustained: 20 req / min
]);
