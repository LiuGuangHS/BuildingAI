const AI_USAGE_NOTICE_KEY = "echoflow-ai-town-ai-usage-ack";

export function readAiUsageAcknowledged() {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(AI_USAGE_NOTICE_KEY) === "true";
    } catch {
        return false;
    }
}

export function writeAiUsageAcknowledged() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(AI_USAGE_NOTICE_KEY, "true");
    } catch {
        // Ignore storage failures in private or embedded environments.
    }
}
