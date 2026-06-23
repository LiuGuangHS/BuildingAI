import { getSessionStorage, safeJsonParse, safeJsonStringify } from "@buildingai/stores";
import type { CreateVideoParams } from "../services/types/generation";

const REUSE_PARAMS_KEY = "echoflow-video:reuse-params";

export function readReuseParams() {
    if (typeof window === "undefined") return undefined;

    let raw: string | null = null;
    try {
        const storage = getSessionStorage();
        raw = storage.getItem(REUSE_PARAMS_KEY);
        storage.removeItem(REUSE_PARAMS_KEY);
    } catch {
        return undefined;
    }
    return safeJsonParse<Partial<CreateVideoParams>>(raw);
}

export function writeReuseParams(params: Partial<CreateVideoParams>) {
    if (typeof window === "undefined") return;
    try {
        getSessionStorage().setItem(REUSE_PARAMS_KEY, safeJsonStringify(params));
    } catch {
        // Ignore storage failures in private or embedded environments.
    }
}
