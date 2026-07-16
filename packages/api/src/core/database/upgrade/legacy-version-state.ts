import { resolveProjectPath } from "@buildingai/config/project-paths";
import fse from "fs-extra";
import path from "path";
import semver from "semver";

async function copyIfMissing(source: string, target: string): Promise<boolean> {
    if (!(await fse.pathExists(source)) || (await fse.pathExists(target))) return false;
    await fse.copy(source, target, { overwrite: false, errorOnExist: false });
    return true;
}

export async function migrateLegacyVersionState(options: {
    legacyDataDir?: string;
    targetDataDir?: string;
} = {}): Promise<string[]> {
    const legacyDataDir = options.legacyDataDir ?? resolveProjectPath("packages", "api", "data");
    const targetDataDir = options.targetDataDir ?? resolveProjectPath("storage", "data");
    const migrated: string[] = [];

    await fse.ensureDir(targetDataDir);
    if (
        await copyIfMissing(
            path.join(legacyDataDir, ".installed"),
            path.join(targetDataDir, ".installed"),
        )
    ) {
        migrated.push(".installed");
    }

    const legacyVersionsDir = path.join(legacyDataDir, "versions");
    if (!(await fse.pathExists(legacyVersionsDir))) return migrated;

    const targetVersionsDir = path.join(targetDataDir, "versions");
    await fse.ensureDir(targetVersionsDir);

    for (const version of await fse.readdir(legacyVersionsDir)) {
        if (!semver.valid(version)) continue;
        const source = path.join(legacyVersionsDir, version);
        if (!(await fse.stat(source)).isFile()) continue;
        if (await copyIfMissing(source, path.join(targetVersionsDir, version))) {
            migrated.push(version);
        }
    }

    return migrated;
}
