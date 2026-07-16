import * as fs from "fs";
import * as path from "path";

export function getProjectRoot(startDir = process.cwd()): string {
    let currentDir = path.resolve(startDir);

    while (true) {
        if (fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) return path.resolve(startDir);
        currentDir = parentDir;
    }
}

export function resolveProjectPath(...segments: string[]): string {
    return path.join(getProjectRoot(), ...segments);
}
