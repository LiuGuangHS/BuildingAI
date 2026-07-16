import fse from "fs-extra";
import os from "os";
import path from "path";

import { migrateLegacyVersionState } from "./legacy-version-state";

describe("migrateLegacyVersionState", () => {
    let rootDir: string;
    let legacyDataDir: string;
    let targetDataDir: string;

    beforeEach(async () => {
        rootDir = await fse.mkdtemp(path.join(os.tmpdir(), "buildingai-version-state-"));
        legacyDataDir = path.join(rootDir, "legacy");
        targetDataDir = path.join(rootDir, "target");
        await fse.ensureDir(path.join(legacyDataDir, "versions"));
        await fse.writeFile(path.join(legacyDataDir, ".installed"), "legacy-installed");
        await fse.writeFile(path.join(legacyDataDir, "versions", "26.1.1"), "legacy-version");
        await fse.writeFile(path.join(legacyDataDir, "versions", "not-a-version"), "ignored");
    });

    afterEach(async () => {
        await fse.remove(rootDir);
    });

    it("copies valid missing markers without overwriting target state", async () => {
        await fse.ensureDir(path.join(targetDataDir, "versions"));
        await fse.writeFile(path.join(targetDataDir, ".installed"), "current-installed");

        await expect(
            migrateLegacyVersionState({ legacyDataDir, targetDataDir }),
        ).resolves.toEqual(["26.1.1"]);
        await expect(fse.readFile(path.join(targetDataDir, ".installed"), "utf8")).resolves.toBe(
            "current-installed",
        );
        await expect(fse.pathExists(path.join(targetDataDir, "versions", "not-a-version"))).resolves.toBe(false);

        await expect(
            migrateLegacyVersionState({ legacyDataDir, targetDataDir }),
        ).resolves.toEqual([]);
    });
});
