import { Logger } from "@nestjs/common";
import type { DataSource } from "@buildingai/db/typeorm";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureBillingColumns();
        await this.ensureProviderConfigTable();
        await this.ensureRequestKeyUniqueIndex();
        this.logger.log("Echoflow Video upgrade to version 0.0.2 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
    }

    private async ensureBillingColumns(): Promise<void> {
        if (!(await this.hasVideoGenerationTable())) {
            this.logger.warn("Skipped Echoflow Video 0.0.2 schema migration because video_generation table does not exist");
            return;
        }

        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "billing_status" varchar(30) NOT NULL DEFAULT 'pending'
        `);

        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "request_key" varchar(100)
        `);
    }

    private async ensureRequestKeyUniqueIndex(): Promise<void> {
        if (!(await this.hasVideoGenerationTable())) {
            this.logger.warn("Skipped Echoflow Video requestKey index because video_generation table does not exist");
            return;
        }

        const duplicateRows = await this.dataSource.query(`
            SELECT "user_id", "request_key", COUNT(*)::int AS count
            FROM "echoflow_video"."video_generation"
            WHERE "request_key" IS NOT NULL
            GROUP BY "user_id", "request_key"
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

        if (duplicateRows.length > 0) {
            this.logger.warn(
                "Skipped unique requestKey index because duplicate video generation records already exist",
            );
            return;
        }

        await this.dataSource.query(`DROP INDEX IF EXISTS "echoflow_video"."idx_video_gen_user_request_key"`);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_generation_user_request_key"
            ON "echoflow_video"."video_generation" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL
        `);
    }

    private async ensureProviderConfigTable(): Promise<void> {
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_provider_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'happyhorse',
                "api_key" text NOT NULL,
                "enabled" boolean NOT NULL DEFAULT true,
                "templates" jsonb NOT NULL DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_provider_config" PRIMARY KEY ("id"),
                CONSTRAINT "uq_video_provider_config_provider" UNIQUE ("provider")
            )
        `);

        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "templates" jsonb NOT NULL DEFAULT '[]'
        `);
    }

    private async hasVideoGenerationTable(): Promise<boolean> {
        const tableExists = await this.dataSource.query(`
            SELECT to_regclass('"echoflow_video"."video_generation"') AS table_name
        `);
        return Boolean(tableExists[0]?.table_name);
    }
}
