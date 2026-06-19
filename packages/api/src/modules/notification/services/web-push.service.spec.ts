import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";

import { assertSafePushEndpoint } from "./web-push-endpoint.util";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
    },
}));

jest.mock("node:dns/promises", () => ({
    lookup: jest.fn(),
}));

const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;
const mockLookupAddresses = (addresses: LookupAddress[]) => {
    mockedLookup.mockResolvedValue(addresses as unknown as Awaited<ReturnType<typeof lookup>>);
};

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
