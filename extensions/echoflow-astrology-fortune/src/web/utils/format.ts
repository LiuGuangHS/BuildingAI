export function formatCredits(value?: number | string | null) {
    const numberValue = Number(value ?? 0);
    if (!Number.isFinite(numberValue)) return "0";
    return numberValue.toFixed(4).replace(/\.?0+$/, "");
}

export function formatDateTime(value?: string | Date | null, fallback = "-") {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    const pad = (item: number) => String(item).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
