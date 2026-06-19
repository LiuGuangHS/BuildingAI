export function createRequestKey(prefix?: string) {
    const value =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    return prefix ? `${prefix}-${value}` : value;
}
