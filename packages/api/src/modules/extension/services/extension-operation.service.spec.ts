const downloadPublicHttpUrl = jest.fn();
const writeFile = jest.fn();

jest.mock("@buildingai/extension-sdk", () => ({ downloadPublicHttpUrl }));
jest.mock("fs-extra", () => ({ writeFile }));
jest.mock("@buildingai/config/db.config", () => ({ createDataSourceConfig: jest.fn() }));
jest.mock("@buildingai/constants", () => ({ ExtensionDownload: { INSTALL: "install" } }));
jest.mock("@buildingai/constants/shared/extension.constant", () => ({ ExtensionStatus: {} }));
jest.mock("@buildingai/core/modules", () => ({
    getExtensionSchemaName: jest.fn(),
    ExtensionConfigService: class {},
    ExtensionSchemaService: class {},
    ExtensionsService: class {},
    FileUploadService: class {},
}));
jest.mock("@buildingai/db", () => ({ BaseSeeder: class {} }));
jest.mock("@buildingai/db/seeds", () => ({ SeedRunner: class {} }));
jest.mock("@buildingai/db/typeorm", () => ({ DataSource: class {} }));
jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: { badRequest: (message: string) => new Error(message) },
}));
jest.mock("@buildingai/logger", () => ({ TerminalLogger: { error: jest.fn() } }));
jest.mock("@buildingai/utils", () => ({ createHttpClient: jest.fn() }));
jest.mock("uuid", () => ({ v4: jest.fn(() => "test-uuid") }));
jest.mock("../../pm2/services/pm2.service", () => ({ Pm2Service: class {} }));
jest.mock("./extension-market.service", () => ({ ExtensionMarketService: class {} }));
jest.mock(
    "@common/modules/auth/services/extension-feature-scan.service",
    () => ({ ExtensionFeatureScanService: class {} }),
    { virtual: true },
);

import { ExtensionDownload } from "@buildingai/constants";

import { ExtensionOperationService } from "./extension-operation.service";

type DownloadServiceHarness = {
    tempDir: string;
    buildPackageBaseName: jest.Mock;
    extractPluginPackage: jest.Mock;
    download: ExtensionOperationService["download"];
};

function createService(): DownloadServiceHarness {
    const service = Object.create(ExtensionOperationService.prototype) as DownloadServiceHarness;
    service.tempDir = "/tmp";
    service.buildPackageBaseName = jest.fn().mockReturnValue("extension-1.0.0");
    service.extractPluginPackage = jest.fn().mockResolvedValue("/extensions/example");

    return service;
}

type ArchiveValidationHarness = {
    assertPluginArchiveEntries: (zip: { getEntries: () => Array<{ entryName: string; isDirectory: boolean; header: { size: number } }> }) => void;
};

function createArchiveService(): ArchiveValidationHarness {
    return Object.create(ExtensionOperationService.prototype) as ArchiveValidationHarness;
}

describe("ExtensionOperationService archive boundary", () => {
    it("rejects archive entries with path traversal before extraction", () => {
        const service = createArchiveService();

        expect(() =>
            service.assertPluginArchiveEntries({
                getEntries: () => [{ entryName: "../package.json", isDirectory: false, header: { size: 1 } }],
            }),
        ).toThrow("invalid file path");
    });

    it("rejects archives whose declared extracted size exceeds the limit", () => {
        const service = createArchiveService();

        expect(() =>
            service.assertPluginArchiveEntries({
                getEntries: () => Array.from({ length: 5 }, (_, index) => ({
                    entryName: `part-${index}.bin`,
                    isDirectory: false,
                    header: { size: 21 * 1024 * 1024 },
                })),
            }),
        ).toThrow("too large when extracted");
    });
});

describe("ExtensionOperationService.download", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects a non-ZIP market response before writing a package", async () => {
        downloadPublicHttpUrl.mockResolvedValue({
            ok: true,
            status: 200,
            url: new URL("https://market.example/extension.bin"),
            headers: {},
            buffer: Buffer.from("not-a-zip"),
        });
        const service = createService();

        await expect(service.download("https://market.example/extension.bin", "example", ExtensionDownload.INSTALL)).rejects.toThrow(
            "Download extension failed",
        );

        expect(downloadPublicHttpUrl).toHaveBeenCalledWith("https://market.example/extension.bin", {
            label: "扩展包",
            urlLabel: "扩展包下载地址",
        });
        expect(writeFile).not.toHaveBeenCalled();
        expect(service.extractPluginPackage).not.toHaveBeenCalled();
    });

    it("rejects an unsuccessful market response before writing a package", async () => {
        downloadPublicHttpUrl.mockResolvedValue({
            ok: false,
            status: 502,
            url: new URL("https://market.example/extension.zip"),
            headers: {},
            buffer: Buffer.alloc(0),
        });
        const service = createService();

        await expect(service.download("https://market.example/extension.zip", "example", ExtensionDownload.INSTALL)).rejects.toThrow(
            "Download extension failed",
        );

        expect(writeFile).not.toHaveBeenCalled();
        expect(service.extractPluginPackage).not.toHaveBeenCalled();
    });

    it("writes a validated ZIP response before extracting it", async () => {
        const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
        downloadPublicHttpUrl.mockResolvedValue({
            ok: true,
            status: 200,
            url: new URL("https://market.example/extension.zip"),
            headers: { "content-disposition": 'attachment; filename="extension.zip"' },
            buffer,
        });
        const service = createService();

        await expect(service.download("https://market.example/extension.zip", "example", ExtensionDownload.INSTALL, "1.0.0")).resolves.toEqual({
            identifier: "example",
            version: "1.0.0",
            pluginDir: "/extensions/example",
            packagePath: "/tmp/extension-1.0.0.zip",
        });

        expect(writeFile).toHaveBeenCalledWith("/tmp/extension-1.0.0.zip", buffer);
        expect(service.extractPluginPackage).toHaveBeenCalledWith(
            "/tmp/extension-1.0.0.zip",
            "example",
            ExtensionDownload.INSTALL,
        );
    });
});
