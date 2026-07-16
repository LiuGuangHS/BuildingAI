import { parseMigrationName } from "./migration-name";

describe("parseMigrationName", () => {
    it.each([
        ["1781452800000-26.1.2-add-table.js", "26.1.2"],
        ["1781452800000-26.1.2-rc.1-add-table.js", "26.1.2-rc.1"],
        ["1781452800000-26.1.2-beta.2-add-table.js", "26.1.2-beta.2"],
    ])("parses %s", (file, version) => {
        expect(parseMigrationName(file)).toEqual({ timestamp: 1781452800000, version });
    });

    it.each(["migration.js", "123-invalid-add-table.js", "123-26.1.2.ts"])(
        "rejects %s",
        (file) => {
            expect(parseMigrationName(file)).toBeNull();
        },
    );
});
