import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";

import { WebPushService } from "./web-push.service";
import { assertSafePushEndpoint } from "./web-push-endpoint.util";

jest.mock("web-push", () => ({
    __esModule: true,
    default: {
        generateVAPIDKeys: () => ({ publicKey: "public-key", privateKey: "private-key" }),
        setVapidDetails: jest.fn(),
        sendNotification: jest.fn(),
    },
}));

jest.mock("@buildingai/db/entities", () => ({ PushSubscription: class PushSubscription {} }));
jest.mock("@buildingai/db/@nestjs/typeorm", () => ({
    InjectRepository: () => () => undefined,
}));
jest.mock("@buildingai/db/typeorm", () => ({}));
jest.mock("@buildingai/dict", () => ({ DictService: class DictService {} }));

jest.mock("@buildingai/errors", () => {
    return {
        ApplicationError: class ApplicationError extends Error {},
        HttpErrorFactory: {
            badRequest: (message: string) => new Error(message),
        },
    };
});

jest.mock("@buildingai/utils", () => ({
    isPrivateOrReservedIp: (address: string) => {
        if (address.startsWith("10.")) return true;
        if (address.startsWith("203.0.113.")) return true;
        return false;
    },
}));

jest.mock("node:dns/promises", () => ({
    lookup: jest.fn(),
}));

const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;
const mockLookupAddresses = (addresses: LookupAddress[]) => {
    mockedLookup.mockResolvedValue(addresses as unknown as Awaited<ReturnType<typeof lookup>>);
};

function createWebPushService(siteUrl: string | null, appDomain?: string) {
    const dictService = {
        get: jest.fn(async (key: string, fallback: unknown) => (key === "url" ? siteUrl : fallback)),
        set: jest.fn(),
    };
    const service = new WebPushService(
        {} as ConstructorParameters<typeof WebPushService>[0],
        dictService as unknown as ConstructorParameters<typeof WebPushService>[1],
    );
    const getSubject = () =>
        (service as unknown as { getVapidSubject: () => Promise<string> }).getVapidSubject();

    return {
        getSubject,
        withAppDomain: async () => {
            const original = process.env.APP_DOMAIN;
            if (appDomain === undefined) {
                delete process.env.APP_DOMAIN;
            } else {
                process.env.APP_DOMAIN = appDomain;
            }
            try {
                return await getSubject();
            } finally {
                if (original === undefined) {
                    delete process.env.APP_DOMAIN;
                } else {
                    process.env.APP_DOMAIN = original;
                }
            }
        },
    };
}

describe("assertSafePushEndpoint", () => {
    beforeEach(() => {
        mockLookupAddresses([{ address: "142.250.72.202", family: 4 }]);
    });

    it("allows known public web push providers", async () => {
        await expect(
            assertSafePushEndpoint("https://fcm.googleapis.com/fcm/send/test-token"),
        ).resolves.toBeUndefined();
        expect(mockedLookup).toHaveBeenCalledWith("fcm.googleapis.com", {
            all: true,
            verbatim: true,
        });
    });

    it("rejects unsupported public https endpoints", async () => {
        await expect(assertSafePushEndpoint("https://example.com/push")).rejects.toThrow(
            "不是受支持的 Push 服务",
        );
    });

    it("rejects localhost, credentials and non-https endpoints", async () => {
        await expect(assertSafePushEndpoint("http://fcm.googleapis.com/fcm/send/test")).rejects.toThrow();
        await expect(assertSafePushEndpoint("https://user:pass@fcm.googleapis.com/fcm/send/test")).rejects.toThrow();
        await expect(assertSafePushEndpoint("https://localhost/fcm/send/test")).rejects.toThrow();
    });

    it("rejects private or reserved resolved addresses", async () => {
        mockLookupAddresses([{ address: "10.0.0.10", family: 4 }]);
        await expect(assertSafePushEndpoint("https://fcm.googleapis.com/fcm/send/test")).rejects.toThrow(
            "不能指向本机或内网",
        );

        mockLookupAddresses([{ address: "203.0.113.5", family: 4 }]);
        await expect(assertSafePushEndpoint("https://fcm.googleapis.com/fcm/send/test")).rejects.toThrow(
            "不能指向本机或内网",
        );
    });
});

describe("WebPushService VAPID subject", () => {
    it("returns only the public VAPID key", async () => {
        const service = new WebPushService(
            {} as ConstructorParameters<typeof WebPushService>[0],
            {
                get: jest.fn().mockResolvedValue({
                    publicKey: "public-key",
                    privateKey: "private-key",
                }),
                set: jest.fn(),
            } as unknown as ConstructorParameters<typeof WebPushService>[1],
        );

        await expect(service.getPublicKey()).resolves.toEqual({ publicKey: "public-key" });
    });

    it("uses configured site URL first", async () => {
        const { getSubject } = createWebPushService("https://ai.example.com/app");

        await expect(getSubject()).resolves.toBe("https://ai.example.com");
    });

    it("falls back to APP_DOMAIN", async () => {
        const { withAppDomain } = createWebPushService("", "https://ai.example.com");

        await expect(withAppDomain()).resolves.toBe("https://ai.example.com");
    });

    it("keeps web push working when no domain is configured", async () => {
        const { withAppDomain } = createWebPushService("");

        await expect(withAppDomain()).resolves.toBe("mailto:webpush@echoflow.cn");
    });
});
