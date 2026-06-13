import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensurePromptOptimizationTable();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.12 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensurePromptOptimizationTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_prompt_optimization" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "request_key" varchar(100),
                "original_prompt" text NOT NULL,
                "optimized_prompt" text NOT NULL,
                "source" varchar(20) NOT NULL,
                "style" varchar(30) NOT NULL,
                "model_id" uuid,
                "usage" jsonb,
                "consumed_power" double precision NOT NULL DEFAULT 0,
                "billing_status" varchar(30) NOT NULL DEFAULT 'free',
                "warning" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_prompt_optimization" PRIMARY KEY ("id")
            )
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_prompt_opt_user"
            ON "echoflow_video"."video_prompt_optimization" ("user_id")
        `);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_prompt_opt_user_request_key"
            ON "echoflow_video"."video_prompt_optimization" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        await this.dataSource.query(
            `
                UPDATE "extension"
                SET "version" = $1, "updated_at" = now()
                WHERE "identifier" = $2
            `,
            ["0.0.12", "echoflow-video"],
        );
    }
}
