import {
    normalizeDedupeKey,
    normalizeNotificationData,
    normalizeNotificationLinkTemplate,
    normalizeNotificationLinkUrl,
    normalizeWechatTemplateConfig,
} from "./notification-normalize.util";

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
