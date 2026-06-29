import { DictService } from "@buildingai/dict";
import { Cron } from "@buildingai/core/@nestjs/schedule";
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { spawn } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream } from "fs";
import { resolve } from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";

const BACKUP_DIR = resolve(process.cwd(), "..", "..", "storage", "backups");
const BACKUP_CONFIG_GROUP = "db_backup_config";
const BACKUP_SCHEDULE = "0 2 * * *";
const BACKUP_FILENAME_REGEX = /^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$/;

function validateBackupFilename(filename: string): string {
    if (typeof filename !== "string" || !BACKUP_FILENAME_REGEX.test(filename)) {
        throw new BadRequestException("Invalid backup filename");
    }
    const resolvedPath = resolve(BACKUP_DIR, filename);
    const normalizedDir = BACKUP_DIR.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = resolvedPath.replace(/\\/g, "/");
    if (!normalizedPath.startsWith(normalizedDir + "/")) {
        throw new BadRequestException("Invalid backup filename");
    }
    return resolvedPath;
}

export interface BackupFile {
    filename: string;
    size: number;
    createdAt: Date;
}

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);

    constructor(private readonly dictService: DictService) {}

    async getConfig() {
        const [enabled, retentionDays] = await Promise.all([
            this.dictService.get<boolean>("auto_backup_enabled", false, BACKUP_CONFIG_GROUP),
            this.dictService.get<number>("backup_retention_days", 7, BACKUP_CONFIG_GROUP),
        ]);

        return {
            enabled,
            schedule: BACKUP_SCHEDULE,
            retentionDays,
        };
    }

    async updateConfig(config: { enabled?: boolean; retentionDays?: number }) {
        if (config.retentionDays !== undefined) {
            if (!Number.isInteger(config.retentionDays) || config.retentionDays < 1 || config.retentionDays > 365) {
                throw new BadRequestException("retentionDays must be an integer between 1 and 365");
            }
        }
        if (config.enabled !== undefined) {
            await this.dictService.set("auto_backup_enabled", config.enabled, { group: BACKUP_CONFIG_GROUP });
        }
        if (config.retentionDays !== undefined) {
            await this.dictService.set("backup_retention_days", config.retentionDays, { group: BACKUP_CONFIG_GROUP });
        }
        return this.getConfig();
    }

    async listBackups(): Promise<BackupFile[]> {
        if (!existsSync(BACKUP_DIR)) {
            return [];
        }

        const files = readdirSync(BACKUP_DIR)
            .filter((f) => BACKUP_FILENAME_REGEX.test(f))
            .map((filename) => {
                const filePath = resolve(BACKUP_DIR, filename);
                const stats = statSync(filePath);
                return {
                    filename,
                    size: stats.size,
                    createdAt: stats.birthtime,
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return files;
    }

    async createBackup(): Promise<{ filename: string; size: number }> {
        if (!existsSync(BACKUP_DIR)) {
            mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `backup_${timestamp}.sql.gz`;
        const filePath = resolve(BACKUP_DIR, filename);
        const tempSqlPath = resolve(BACKUP_DIR, `temp_${Date.now()}.sql`);

        try {
            const dbHost = process.env.DB_HOST || "localhost";
            const dbPort = process.env.DB_PORT || "5432";
            const dbUser = process.env.DB_USERNAME || "postgres";
            const dbName = process.env.DB_DATABASE || "buildingai";
            const dbPassword = process.env.DB_PASSWORD || "postgres";

            this.logger.log(`Starting database backup to ${filename}...`);

            await new Promise<void>((resolvePromise, reject) => {
                const pgDump = spawn("pg_dump", [
                    "-h", dbHost,
                    "-p", dbPort,
                    "-U", dbUser,
                    "-d", dbName,
                    "-f", tempSqlPath,
                ], {
                    env: {
                        ...process.env,
                        PGPASSWORD: dbPassword,
                    },
                    stdio: ["ignore", "pipe", "pipe"],
                });

                let stderr = "";
                pgDump.stderr.on("data", (data) => {
                    stderr += data.toString();
                });

                pgDump.on("close", (code) => {
                    if (code === 0) {
                        resolvePromise();
                    } else {
                        reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
                    }
                });

                pgDump.on("error", (err) => {
                    reject(err);
                });
            });

            const gzip = createGzip();
            const source = createReadStream(tempSqlPath);
            const destination = createWriteStream(filePath);
            await pipeline(source, gzip, destination);

            unlinkSync(tempSqlPath);

            const stats = statSync(filePath);
            this.logger.log(`Backup completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

            await this.cleanupOldBackups();

            return {
                filename,
                size: stats.size,
            };
        } catch (error) {
            if (existsSync(tempSqlPath)) {
                try { unlinkSync(tempSqlPath); } catch {}
            }
            this.logger.error(`Backup failed: ${error.message}`);
            throw new InternalServerErrorException(`Backup failed: ${error.message}`);
        }
    }

    async deleteBackup(filename: string): Promise<void> {
        const filePath = validateBackupFilename(filename);

        if (!existsSync(filePath)) {
            throw new NotFoundException("Backup file not found");
        }

        unlinkSync(filePath);
        this.logger.log(`Backup deleted: ${filename}`);
    }

    async cleanupOldBackups(): Promise<void> {
        const config = await this.getConfig();
        const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - retentionMs;

        const backups = await this.listBackups();
        for (const backup of backups) {
            if (backup.createdAt.getTime() < cutoffTime) {
                await this.deleteBackup(backup.filename);
            }
        }
    }

    @Cron(BACKUP_SCHEDULE, {
        name: "auto-db-backup",
        timeZone: "Asia/Shanghai",
    })
    async handleScheduledBackup() {
        try {
            const config = await this.getConfig();
            if (!config.enabled) {
                return;
            }

            this.logger.log("Starting scheduled database backup...");
            await this.createBackup();
        } catch (error) {
            this.logger.error(`Scheduled backup failed: ${error.message}`);
        }
    }
}
