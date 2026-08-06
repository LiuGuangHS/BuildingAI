import { ExtensionMarketService } from "./extension-market.service";

const clients = [
    { get: jest.fn(), post: jest.fn(), interceptors: { request: { use: jest.fn() } } },
    { get: jest.fn(), post: jest.fn(), interceptors: { request: { use: jest.fn() } } },
];

jest.mock("@buildingai/utils", () => ({
    createHttpClient: jest.fn(() => clients.shift()),
}));
jest.mock("@buildingai/dict", () => ({ DictService: class DictService {} }));
jest.mock("@buildingai/core/modules", () => ({
    getExtensionEnabledStatus: jest.fn().mockResolvedValue(null),
    isExtensionCompatible: jest.fn().mockResolvedValue(true),
    ExtensionsService: class ExtensionsService {},
}));
jest.mock("@buildingai/constants", () => ({ ExtensionStatus: { ENABLED: 1, DISABLED: 0 } }));
jest.mock("@buildingai/constants/server/dict-key.constant", () => ({
    DICT_GROUP_KEYS: { APPLICATION: "application" },
    DICT_KEYS: { PLATFORM_SECRET: "platform-secret" },
}));
jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: { badRequest: (message: string) => new Error(message) },
}));
jest.mock("@buildingai/config", () => ({ AppConfig: { version: "26.1.0" } }));
jest.mock(
    "@common/utils/system-id",
    () => ({ getOrCreateSystemId: jest.fn().mockResolvedValue("system-key") }),
    { virtual: true },
);

describe("ExtensionMarketService", () => {
    it("marks a remote extension as updatable from the market version list", async () => {
        const [marketClient, appsMarketClient] = clients;
        appsMarketClient.get.mockResolvedValue({
            data: [{ key: "remote-extension", newVersion: "1.2.0" }],
        });
        const service = new ExtensionMarketService(
            { get: jest.fn() } as unknown as ConstructorParameters<typeof ExtensionMarketService>[0],
            {
                findAll: jest.fn().mockResolvedValue([
                    {
                        identifier: "remote-extension",
                        version: "1.0.0",
                        isLocal: false,
                        status: 1,
                    },
                ]),
            } as unknown as ConstructorParameters<typeof ExtensionMarketService>[1],
        );

        await expect(service.getMixedApplicationList()).resolves.toEqual([
            expect.objectContaining({
                identifier: "remote-extension",
                latestVersion: "1.2.0",
                hasUpdate: true,
            }),
        ]);
        expect(appsMarketClient.get).toHaveBeenCalledWith("/appsLists", {
            headers: { "system-key": "system-key" },
        });
        expect(marketClient.get).not.toHaveBeenCalled();
    });

    it("skips the market update check when no system key is available", async () => {
        const marketClient = { get: jest.fn(), post: jest.fn(), interceptors: { request: { use: jest.fn() } } };
        const appsMarketClient = {
            get: jest.fn(),
            post: jest.fn(),
            interceptors: { request: { use: jest.fn() } },
        };
        clients.push(marketClient, appsMarketClient);
        const { getOrCreateSystemId } = jest.requireMock("@common/utils/system-id");
        getOrCreateSystemId.mockResolvedValueOnce(null);
        const service = new ExtensionMarketService(
            { get: jest.fn() } as unknown as ConstructorParameters<typeof ExtensionMarketService>[0],
            {
                findAll: jest.fn().mockResolvedValue([
                    { identifier: "remote-extension", version: "1.0.0", isLocal: false, status: 1 },
                ]),
            } as unknown as ConstructorParameters<typeof ExtensionMarketService>[1],
        );

        await expect(service.getMixedApplicationList()).resolves.toEqual([
            expect.objectContaining({ identifier: "remote-extension", hasUpdate: false }),
        ]);
        expect(appsMarketClient.get).not.toHaveBeenCalled();
    });
});
