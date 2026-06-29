import { HttpErrorFactory } from "@buildingai/errors";
import { createHash } from "node:crypto";

export const MAX_NOTIFICATION_DATA_BYTES = 16 * 1024;
export const FIELD_LIMITS = {
    title: 128,
    type: 32,
    extensionId: 64,
    sceneCode: 96,
    sourceType: 64,
    sourceId: 96,
    dedupeKey: 160,
    content: 4000,
    level: 16,
    linkUrl: 512,
    sceneName: 64,
    sceneDescription: 1000,
    contentTemplate: 4000,
    wechatTemplateId: 128,
    wechatFieldKey: 64,
    wechatFieldTemplate: 256,
} as const;

type NotificationChannel = "in_app" | "web_push" | "wechat_oa_template" | "sms";

export function normalizeChannels(channels?: string[] | null): NotificationChannel[] {
    const allowed = new Set<NotificationChannel>([
        "in_app",
        "web_push",
        "wechat_oa_template",
        "sms",
    ]);
    return (channels || [])
        .filter((channel): channel is NotificationChannel => allowed.has(channel as NotificationChannel));
}

export function normalizeSceneChannels(channels?: string[] | null) {
    const normalized = normalizeChannels(channels);
    if (!normalized.length) {
        throw HttpErrorFactory.badRequest("通知场景至少需要启用一个渠道");
    }
    return normalized;
}

export function normalizeStringField(
    value: string | null | undefined,
    maxLength: number,
    label: string,
) {
    const normalized = value?.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
        throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxLength} 个字符`);
    }
    return normalized;
}

export function normalizeNullableText(value: string | null | undefined, maxLength: number, label: string) {
    const normalized = value?.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
        throw HttpErrorFactory.badRequest(`${label}不能超过 ${maxLength} 个字符`);
    }
    return normalized;
}

export function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    const integer = Math.floor(numeric);
    if (integer < 1) return fallback;
    return Math.min(integer, max);
}

export function normalizeDedupeKey(value?: string | null) {
    const normalized = value?.trim();
    if (!normalized) return null;
    if (normalized.length <= FIELD_LIMITS.dedupeKey) return normalized;

    const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
    const prefix = normalized.slice(0, FIELD_LIMITS.dedupeKey - digest.length - 1);
    return `${prefix}:${digest}`;
}

export function normalizeNotificationData(data: Record<string, unknown>) {
    let json: string;
    try {
        json = JSON.stringify(data);
    } catch {
        throw HttpErrorFactory.badRequest("通知扩展数据必须是可序列化 JSON");
    }
    if (Buffer.byteLength(json, "utf8") > MAX_NOTIFICATION_DATA_BYTES) {
        throw HttpErrorFactory.badRequest("通知扩展数据过大");
    }
    return data;
}

export function normalizeNotificationLinkUrl(linkUrl?: string | null) {
    const trimmed = linkUrl?.trim();
    if (!trimmed) return null;
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
        throw HttpErrorFactory.badRequest("通知跳转链接包含非法字符");
    }
    if (trimmed.startsWith("/")) {
        if (trimmed.startsWith("//")) {
            throw HttpErrorFactory.badRequest("通知跳转链接不能使用协议相对地址");
        }
        if (trimmed.length > FIELD_LIMITS.linkUrl) {
            throw HttpErrorFactory.badRequest(`通知跳转链接不能超过 ${FIELD_LIMITS.linkUrl} 个字符`);
        }
        return trimmed;
    }

    throw HttpErrorFactory.badRequest("通知跳转链接仅支持站内相对路径");
}

export function normalizeNotificationLinkTemplate(template?: string | null) {
    const trimmed = template?.trim();
    if (!trimmed) return null;
    if (!trimmed.includes("{{")) {
        normalizeNotificationLinkUrl(trimmed);
        return trimmed;
    }

    const sampleUrl = trimmed.replace(/\{\{\s*[\w.]+\s*\}\}/g, "placeholder");
    try {
        normalizeNotificationLinkUrl(sampleUrl);
    } catch (error) {
        if (!/^\{\{\s*[\w.]+\s*\}\}$/.test(trimmed)) {
            throw error;
        }
    }
    return trimmed;
}

export function normalizeWechatTemplateConfig(template?: Record<string, unknown> | null) {
    if (!template || typeof template !== "object") return {};
    const result: Record<string, unknown> = {};
    const templateId = normalizeStringField(
        typeof template.templateId === "string" ? template.templateId : null,
        FIELD_LIMITS.wechatTemplateId,
        "微信模板 ID",
    );
    if (templateId) result.templateId = templateId;
    if (typeof template.url === "string") {
        result.url = normalizeNotificationLinkTemplate(template.url);
    }
    if (template.fields && typeof template.fields === "object" && !Array.isArray(template.fields)) {
        result.fields = Object.entries(template.fields as Record<string, unknown>).reduce<Record<string, string>>(
            (fields, [key, value]) => {
                const fieldKey = normalizeStringField(key, FIELD_LIMITS.wechatFieldKey, "微信模板字段名");
                if (!fieldKey) return fields;
                fields[fieldKey] = normalizeStringField(
                    String(value ?? ""),
                    FIELD_LIMITS.wechatFieldTemplate,
                    "微信模板字段",
                ) || "";
                return fields;
            },
            {},
        );
    }
    return result;
}
