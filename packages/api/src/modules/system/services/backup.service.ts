import { resolveProjectPath } from "@buildingai/config/project-paths";
import { Cron } from "@buildingai/core/@nestjs/schedule";
import { DataSource } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { spawn } from "child_process";
import {
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    statSync,
    unlinkSync,
} from "fs";
import { resolve } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";

const BACKUP_DIR = resolveProjectPath("storage", "backups");
const BACKUP_CONFIG_GROUP = "db_backup_config";
const BACKUP_SCHEDULE = "0 2 * * *";
const BACKUP_FILENAME_REGEX =
    /^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?\.sql\.gz$/;
const BACKUP_LOCK_NAME = "echoflow:database-backup";
const PG_DUMP_TIMEOUT_MS = 10 * 60 * 1000;

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

    constructor(
        private readonly dictService: DictService,
        private readonly dataSource: DataSource,
    ) {}

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
                    createdAt: stats.mtime,
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return files;
    }

    async createBackup(): Promise<{ filename: string; size: number }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const [{ locked }] = await queryRunner.query(
                "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
                [BACKUP_LOCK_NAME],
            );
            if (!locked) {
                throw new ConflictException("A database backup is already running");
            }

            try {
                return await this.createBackupWithLock();
            } finally {
                await queryRunner.query("SELECT pg_advisory_unlock(hashtext($1))", [BACKUP_LOCK_NAME]);
            }
        } finally {
            await queryRunner.release();
        }
    }

    private async createBackupWithLock(): Promise<{ filename: string; size: number }> {
        if (!existsSync(BACKUP_DIR)) {
            mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
        const filename = `backup_${timestamp}.sql.gz`;
        const filePath = resolve(BACKUP_DIR, filename);
        const tempSqlPath = resolve(BACKUP_DIR, `temp_${Date.now()}.sql`);
        const partFilePath = `${filePath}.part`;

        try {
            const dbHost = process.env.DB_HOST || "localhost";
            const dbPort = process.env.DB_PORT || "5432";
            const dbUser = process.env.DB_USERNAME || "postgres";
            const dbName = process.env.DB_DATABASE || "buildingai";
            const dbPassword = process.env.DB_PASSWORD || "postgres";

            this.logger.log(`Starting database backup to ${filename}...`);

            await new Promise<void>((resolvePromise, reject) => {
                let settled = false;
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
                    stderr = `${stderr}${data.toString()}`.slice(-4000);
                });

                const timeoutId = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    pgDump.kill("SIGTERM");
                    reject(new Error(`pg_dump timed out after ${PG_DUMP_TIMEOUT_MS}ms`));
                }, PG_DUMP_TIMEOUT_MS);

                pgDump.on("close", (code) => {
                    clearTimeout(timeoutId);
                    if (settled) return;
                    settled = true;
                    if (code === 0) {
                        resolvePromise();
                    } else {
                        reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
                    }
                });

                pgDump.on("error", (err) => {
                    clearTimeout(timeoutId);
                    if (settled) return;
                    settled = true;
                    reject(err);
                });
            });

            const gzip = createGzip();
            const source = createReadStream(tempSqlPath);
            const destination = createWriteStream(partFilePath);
            await pipeline(source, gzip, destination);

            unlinkSync(tempSqlPath);
            renameSync(partFilePath, filePath);

            const stats = statSync(filePath);
            this.logger.log(`Backup completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

            try {
                await this.cleanupOldBackups();
            } catch (error) {
                this.logger.warn(`Backup cleanup failed: ${this.errorMessage(error)}`);
            }

            return {
                filename,
                size: stats.size,
            };
        } catch (error) {
            if (existsSync(tempSqlPath)) {
                try { unlinkSync(tempSqlPath); } catch {}
            }
            if (existsSync(partFilePath)) {
                try { unlinkSync(partFilePath); } catch {}
            }
            const message = this.errorMessage(error);
            this.logger.error(`Backup failed: ${message}`);
            throw new InternalServerErrorException(`Backup failed: ${message}`);
        }
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
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
            this.logger.error(`Scheduled backup failed: ${this.errorMessage(error)}`);
        }
    }
}
