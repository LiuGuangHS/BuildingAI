import type { CreateVideoParams } from "../services/types/generation";

const REUSE_PARAMS_KEY = "echoflow-video:reuse-params";

export function readReuseParams() {
    if (typeof window === "undefined") return undefined;

    let raw: string | null = null;
    try {
        raw = window.sessionStorage.getItem(REUSE_PARAMS_KEY);
        window.sessionStorage.removeItem(REUSE_PARAMS_KEY);
    } catch {
        return undefined;
    }
    if (!raw) return undefined;

    try {
        return JSON.parse(raw) as Partial<CreateVideoParams>;
    } catch {
        return undefined;
    }
}

export function writeReuseParams(params: Partial<CreateVideoParams>) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(REUSE_PARAMS_KEY, JSON.stringify(params));
    } catch {
        // Ignore storage failures in private or embedded environments.
    }
}
