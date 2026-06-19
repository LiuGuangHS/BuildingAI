import {
    normalizeDedupeKey,
    normalizeNotificationData,
    normalizeNotificationLinkTemplate,
    normalizeNotificationLinkUrl,
    normalizeNullableText,
    normalizePositiveInteger,
    normalizeWechatTemplateConfig,
    FIELD_LIMITS,
} from "./notification-normalize.util";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
    },
}));

describe("notification normalization helpers", () => {
    it("allows relative and http notification links", () => {
        expect(normalizeNotificationLinkUrl("/extension/echoflow-video/?tab=history")).toBe(
            "/extension/echoflow-video/?tab=history",
        );
        expect(normalizeNotificationLinkUrl("https://example.com/path")).toBe("https://example.com/path");
    });

    it("rejects unsafe notification links", () => {
        expect(() => normalizeNotificationLinkUrl("//evil.example/path")).toThrow();
        expect(() => normalizeNotificationLinkUrl("javascript:alert(1)")).toThrow();
        expect(() => normalizeNotificationLinkUrl("https://user:pass@example.com/path")).toThrow();
        expect(() => normalizeNotificationLinkUrl(`/path/${"x".repeat(600)}`)).toThrow();
    });

    it("validates link templates without rejecting normal placeholders", () => {
        expect(normalizeNotificationLinkTemplate("/extension/{{extensionId}}/?id={{sourceId}}")).toBe(
            "/extension/{{extensionId}}/?id={{sourceId}}",
        );
        expect(normalizeNotificationLinkTemplate("{{dynamicUrl}}")).toBe("{{dynamicUrl}}");
        expect(() => normalizeNotificationLinkTemplate("javascript:{{payload}}")).toThrow();
    });

    it("hashes long dedupe keys into a stable database-sized value", () => {
        const key = `video:${"source".repeat(80)}`;
        const normalized = normalizeDedupeKey(key);
        expect(normalized).toHaveLength(160);
        expect(normalized).toBe(normalizeDedupeKey(key));
        expect(normalized).not.toBe(key);
    });

    it("rejects unserializable or oversized notification data", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => normalizeNotificationData(circular)).toThrow();
        expect(() => normalizeNotificationData({ value: "x".repeat(20 * 1024) })).toThrow();
        expect(normalizeNotificationData({ ok: true })).toEqual({ ok: true });
    });

    it("limits notification content and normalizes pagination numbers", () => {
        expect(normalizeNullableText("  hello  ", FIELD_LIMITS.content, "通知内容")).toBe("hello");
        expect(() => normalizeNullableText("x".repeat(FIELD_LIMITS.content + 1), FIELD_LIMITS.content, "通知内容")).toThrow();
        expect(normalizePositiveInteger(undefined, 1, 50)).toBe(1);
        expect(normalizePositiveInteger(-10, 1, 50)).toBe(1);
        expect(normalizePositiveInteger(2.8, 1, 50)).toBe(2);
        expect(normalizePositiveInteger(500, 1, 50)).toBe(50);
    });

    it("normalizes wechat template config", () => {
        expect(
            normalizeWechatTemplateConfig({
                templateId: " template-id ",
                url: "/extension/{{extensionId}}/",
                fields: {
                    thing1: " {{taskName}} ",
                    ignoredEmpty: "",
                },
            }),
        ).toEqual({
            templateId: "template-id",
            url: "/extension/{{extensionId}}/",
            fields: {
                thing1: "{{taskName}}",
                ignoredEmpty: "",
            },
        });
        expect(() => normalizeWechatTemplateConfig({ url: "data:text/html,hello" })).toThrow();
    });
});
