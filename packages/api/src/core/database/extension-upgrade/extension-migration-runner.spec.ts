jest.mock("@buildingai/logger", () => ({ TerminalLogger: { log: jest.fn(), error: jest.fn(), success: jest.fn() } }));
jest.mock("@nestjs/common", () => ({ Logger: class { log = jest.fn(); error = jest.fn(); } }));

import { ExtensionMigrationRunner } from "./extension-migration-runner";

describe("ExtensionMigrationRunner failure boundary", () => {
    it("propagates database errors without recording completion", async () => {
        const migrationError = Object.assign(new Error("duplicate object"), { code: "23505" });
        const runner = new ExtensionMigrationRunner({} as never, "test-extension");
        const recordMigrationExecution = jest.fn();
        (runner as never as { recordMigrationExecution: jest.Mock }).recordMigrationExecution =
            recordMigrationExecution;
        (runner as never as { isMigrationExecuted: jest.Mock }).isMigrationExecuted = jest
            .fn()
            .mockRejectedValue(migrationError);
        const migration = {
            name: "1762769127629-0.0.1-add-table.js",
            path: "/tmp/add-table.js",
            version: "0.0.1",
            timestamp: 1762769127629,
        };
        const executeMigration = (runner as never as { executeMigration: Function }).executeMigration;

        await expect(executeMigration.call(runner, migration)).rejects.toBe(migrationError);
        expect(recordMigrationExecution).not.toHaveBeenCalled();
    });
});
