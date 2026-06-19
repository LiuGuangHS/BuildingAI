import { HttpError } from "../core/types";

export function createRequestId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createAbortError(): HttpError {
    return new HttpError({
        name: "HttpAbortError",
        message: "Request aborted",
        code: "ERR_CANCELED",
    });
}
