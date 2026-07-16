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
import { getExtensionIdentifierFromStack } from "@buildingai/core/modules";
import { ExtensionNotificationService } from "@buildingai/extension-sdk/notification";

jest.mock("@buildingai/errors", () => {
    return {
        ApplicationError: class ApplicationError extends Error {},
        HttpErrorFactory: {
            badRequest: (message: string) => new Error(message),
        },
    };
});

jest.mock("@buildingai/core/modules", () => ({
    EXTENSION_NOTIFICATION_PORT: Symbol.for("EXTENSION_NOTIFICATION_PORT"),
    getExtensionIdentifierFromStack: jest.fn(),
}));

describe("notification normalization helpers", () => {
    it("allows relative notification links", () => {
        expect(normalizeNotificationLinkUrl("/extension/echoflow-video/?tab=history")).toBe(
            "/extension/echoflow-video/?tab=history",
        );
    });

    it("rejects unsafe notification links", () => {
        expect(() => normalizeNotificationLinkUrl("//evil.example/path")).toThrow();
        expect(() => normalizeNotificationLinkUrl("https://example.com/path")).toThrow();
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

describe("extension notification SDK boundary", () => {
    const mockedGetExtensionIdentifierFromStack = getExtensionIdentifierFromStack as jest.MockedFunction<
        typeof getExtensionIdentifierFromStack
    >;

    beforeEach(() => {
        mockedGetExtensionIdentifierFromStack.mockReset();
        mockedGetExtensionIdentifierFromStack.mockReturnValue("echoflow-video");
    });

    it("rejects registering scenes under another extension namespace", async () => {
        const notificationPort = {
            registerScenes: jest.fn(),
            notifyUser: jest.fn(),
        };
        const service = new ExtensionNotificationService(notificationPort);

        await expect(
            service.registerScenes("echoflow-image", [
                {
                    sceneCode: "echoflow-image.generation.succeeded",
                    name: "图片生成完成",
                    description: "图片生成完成",
                    level: "success",
                    titleTemplate: "图片生成完成",
                    contentTemplate: "图片生成完成",
                },
            ]),
        ).rejects.toThrow(
            'Notification extensionId "echoflow-image" does not match caller extension "echoflow-video"',
        );
        expect(notificationPort.registerScenes).not.toHaveBeenCalled();
    });

    it("registers explicit extension scenes when stack resolution is unavailable", async () => {
        mockedGetExtensionIdentifierFromStack.mockReturnValue(null);
        const notificationPort = {
            registerScenes: jest.fn().mockResolvedValue(undefined),
            notifyUser: jest.fn(),
        };
        const service = new ExtensionNotificationService(notificationPort);

        await expect(
            service.registerScenes("echoflow-video", [
                {
                    sceneCode: "echoflow-video.generation.succeeded",
                    name: "视频生成完成",
                    description: "视频生成完成",
                    level: "success",
                    titleTemplate: "视频生成完成",
                    contentTemplate: "视频生成完成",
                },
            ]),
        ).resolves.toBeUndefined();

        expect(notificationPort.registerScenes).toHaveBeenCalledWith(
            "echoflow-video",
            [
                expect.objectContaining({
                    sceneCode: "echoflow-video.generation.succeeded",
                    channels: ["in_app", "web_push"],
                }),
            ],
        );
    });

    it("still requires stack resolution when scenes are registered without an explicit extensionId", async () => {
        mockedGetExtensionIdentifierFromStack.mockReturnValue(null);
        const notificationPort = {
            registerScenes: jest.fn(),
            notifyUser: jest.fn(),
        };
        const service = new ExtensionNotificationService(notificationPort);

        await expect(
            service.registerScenes([
                {
                    sceneCode: "echoflow-video.generation.succeeded",
                    name: "视频生成完成",
                    description: "视频生成完成",
                    level: "success",
                    titleTemplate: "视频生成完成",
                    contentTemplate: "视频生成完成",
                },
            ]),
        ).rejects.toThrow("Extension notification requires an explicit extensionId");
    });

    it("ignores caller supplied extensionId when sending notifications", async () => {
        const notificationPort = {
            registerScenes: jest.fn(),
            notifyUser: jest.fn().mockResolvedValue({ notificationId: "notification-1" }),
        };
        const service = new ExtensionNotificationService(notificationPort);

        await expect(
            service.notifyUser({
                extensionId: "echoflow-image",
                userId: "user-1",
                sceneCode: "echoflow-video.generation.succeeded",
                title: "视频生成完成",
            } as Parameters<ExtensionNotificationService["notifyUser"]>[0] & { extensionId: string }),
        ).resolves.toEqual({ notificationId: "notification-1" });

        expect(notificationPort.notifyUser).toHaveBeenCalledWith(
            "echoflow-video",
            expect.objectContaining({
                sceneCode: "echoflow-video.generation.succeeded",
                type: "echoflow-video",
                data: expect.objectContaining({
                    extensionId: "echoflow-video",
                }),
            }),
        );
    });
});

describe("notification platform default scene boundary", () => {
    it("keeps EchoFlow video scenes registered by the video plugin, not platform defaults", async () => {
        const source = require("node:fs").readFileSync(
            require("node:path").resolve(__dirname, "notification.service.ts"),
            "utf8",
        );

        expect(source).not.toContain('sceneCode: "echoflow-video.generation.succeeded"');
        expect(source).not.toContain('sceneCode: "echoflow-video.generation.failed"');
        expect(source).toContain('sceneCode: "system.test"');
    });
});
