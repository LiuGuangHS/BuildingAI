import { Logger } from "@nestjs/common";
import type { DataSource } from "@buildingai/db/typeorm";

import { encryptApiKey, isEncrypted } from "../../common/crypto/encryption";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureTemplatesColumn();
        await this.migratePlaintextApiKeys();
        this.logger.log("Echoflow Video upgrade to version 0.0.3 completed");
    }

    private async ensureTemplatesColumn(): Promise<void> {
        const tableExists = await this.dataSource.query(`
            SELECT to_regclass('"echoflow_video"."video_provider_config"') AS table_name
        `);
        if (!tableExists[0]?.table_name) {
            this.logger.warn(
                "Skipped templates column migration because video_provider_config table does not exist",
            );
            return;
        }

        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "templates" jsonb NOT NULL DEFAULT '[]'
        `);
    }

    private async migratePlaintextApiKeys(): Promise<void> {
        const tableExists = await this.dataSource.query(`
            SELECT to_regclass('"echoflow_video"."video_provider_config"') AS table_name
        `);
        if (!tableExists[0]?.table_name) {
            this.logger.warn(
                "Skipped API key encryption migration because video_provider_config table does not exist",
            );
            return;
        }

        const rows: Array<{ id: string; api_key: string }> = await this.dataSource.query(`
            SELECT "id", "api_key" FROM "echoflow_video"."video_provider_config"
        `);

        let encrypted = 0;
        let skipped = 0;

        for (const row of rows) {
            if (!row.api_key) {
                skipped++;
                continue;
            }

            if (isEncrypted(row.api_key)) {
                skipped++;
                continue;
            }

            try {
                const encryptedKey = encryptApiKey(row.api_key);
                await this.dataSource.query(
                    `UPDATE "echoflow_video"."video_provider_config" SET "api_key" = $1 WHERE "id" = $2`,
                    [encryptedKey, row.id],
                );
                encrypted++;
            } catch (error) {
                this.logger.error(
                    `Failed to encrypt API key for provider config ${row.id}: ${(error as Error).message}`,
                );
            }
        }

        this.logger.log(
            `API key encryption migration: ${encrypted} encrypted, ${skipped} skipped (already encrypted or empty)`,
        );
    }
}
