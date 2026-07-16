import semver from "semver";

export type ParsedMigrationName = {
    timestamp: number;
    version: string;
};

export function parseMigrationName(file: string): ParsedMigrationName | null {
    const match = file.match(/^(\d+)-(.+)\.js$/);
    if (!match) return null;

    const [, timestamp, rest] = match;
    const parts = rest.split("-");
    const baseVersion = parts[0];
    if (!semver.valid(baseVersion)) return null;

    const prerelease = parts[1];
    const version = prerelease && /^(alpha|beta|rc|next)\.\d+$/.test(prerelease)
        ? `${baseVersion}-${prerelease}`
        : baseVersion;

    return { timestamp: Number(timestamp), version };
}
