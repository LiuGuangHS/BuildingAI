import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensurePromptOptimizerBillingColumns();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.10 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
    }

    private async ensurePromptOptimizerBillingColumns(): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_allowed_model_ids" jsonb NOT NULL DEFAULT '[]'
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_billing_enabled" boolean NOT NULL DEFAULT true
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_billing_power" integer NOT NULL DEFAULT 1
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_billing_tokens" integer NOT NULL DEFAULT 1000
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_estimated_tokens" integer NOT NULL DEFAULT 500
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        await this.dataSource.query(
            `
                UPDATE "extension"
                SET "version" = $1, "updated_at" = now()
                WHERE "identifier" = $2
            `,
            ["0.0.10", "echoflow-video"],
        );
    }
}
