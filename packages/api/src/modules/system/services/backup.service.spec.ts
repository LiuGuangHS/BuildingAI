jest.mock("@buildingai/config/project-paths", () => ({
    resolveProjectPath: (...parts: string[]) => ["/tmp", ...parts].join("/"),
}));
jest.mock("@buildingai/core/@nestjs/schedule", () => ({ Cron: () => () => undefined }));
jest.mock("@buildingai/db/typeorm", () => ({ DataSource: class {} }));
jest.mock("@buildingai/dict", () => ({ DictService: class {} }));
jest.mock("child_process", () => ({ spawn: jest.fn() }));
jest.mock("fs", () => ({
    createReadStream: jest.fn(),
    createWriteStream: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    renameSync: jest.fn(),
    statSync: jest.fn(),
    unlinkSync: jest.fn(),
}));
jest.mock("stream/promises", () => ({ pipeline: jest.fn() }));
jest.mock("zlib", () => ({ createGzip: jest.fn() }));

import { BackupService } from "./backup.service";

type BackupHarness = {
    dictService: { get: jest.Mock; set: jest.Mock };
    dataSource: { createQueryRunner: jest.Mock };
    createBackupWithLock: jest.Mock;
    updateConfig: BackupService["updateConfig"];
    createBackup: BackupService["createBackup"];
    getConfig: BackupService["getConfig"];
    handleScheduledBackup: BackupService["handleScheduledBackup"];
};

function createService(): BackupHarness {
    const service = Object.create(BackupService.prototype) as BackupHarness;
    service.dictService = {
        get: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(7),
        set: jest.fn(),
    };
    service.dataSource = { createQueryRunner: jest.fn() };
    service.createBackupWithLock = jest.fn().mockResolvedValue({ filename: "backup.sql.gz", size: 1 });
    return service;
}

describe("BackupService", () => {
    it("rejects retention outside the supported range", async () => {
        const service = createService();

        await expect(service.updateConfig({ retentionDays: 0 })).rejects.toThrow(
            "retentionDays must be an integer between 1 and 365",
        );
        await expect(service.updateConfig({ retentionDays: 366 })).rejects.toThrow(
            "retentionDays must be an integer between 1 and 365",
        );
    });

    it("releases the advisory lock after a successful backup", async () => {
        const query = jest.fn()
            .mockResolvedValueOnce([{ locked: true }])
            .mockResolvedValueOnce([]);
        const release = jest.fn();
        const service = createService();
        service.dataSource.createQueryRunner.mockReturnValue({ connect: jest.fn(), query, release });

        await expect(service.createBackup()).resolves.toEqual({ filename: "backup.sql.gz", size: 1 });

        expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("pg_try_advisory_lock"), expect.any(Array));
        expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("pg_advisory_unlock"), expect.any(Array));
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("rejects concurrent backups without running the backup body", async () => {
        const query = jest.fn().mockResolvedValueOnce([{ locked: false }]);
        const service = createService();
        service.dataSource.createQueryRunner.mockReturnValue({ connect: jest.fn(), query, release: jest.fn() });

        await expect(service.createBackup()).rejects.toThrow("A database backup is already running");
        expect(service.createBackupWithLock).not.toHaveBeenCalled();
    });

    it("does not start a scheduled backup when disabled", async () => {
        const service = createService();
        service.getConfig = jest.fn().mockResolvedValue({ enabled: false, retentionDays: 7 });
        service.createBackup = jest.fn();

        await service.handleScheduledBackup();

        expect(service.createBackup).not.toHaveBeenCalled();
    });
});
