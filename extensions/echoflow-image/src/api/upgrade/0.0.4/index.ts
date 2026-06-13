import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureExtensions();
        await this.ensureConfigTables();
        await this.ensureGenerationTable();
        await this.ensureIndexes();
        this.logger.log("Echoflow Image upgrade to version 0.0.4 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_image"`);
    }

    private async ensureExtensions(): Promise<void> {
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensureConfigTables(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_model_config" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "ai_model_id" uuid NOT NULL,
                "display_name" varchar(120) NOT NULL,
                "description" text,
                "enabled" boolean NOT NULL DEFAULT true,
                "api_mode" varchar(30) NOT NULL DEFAULT 'images',
                "responses_transport" varchar(30) NOT NULL DEFAULT 'sse',
                "request_policy" varchar(30) NOT NULL DEFAULT 'openai',
                "capabilities" jsonb NOT NULL DEFAULT '{}',
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "allowed_params" jsonb NOT NULL DEFAULT '{}',
                "sort_order" int NOT NULL DEFAULT 0,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_billing_rule" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "model_config_id" uuid,
                "base_cost" numeric(10,2) NOT NULL DEFAULT 1,
                "text_to_image_multiplier" numeric(10,2) NOT NULL DEFAULT 1,
                "image_to_image_multiplier" numeric(10,2) NOT NULL DEFAULT 1.5,
                "quality_multipliers" jsonb NOT NULL DEFAULT '{}',
                "size_multipliers" jsonb NOT NULL DEFAULT '{}',
                "count_multiplier_enabled" boolean NOT NULL DEFAULT true,
                "refund_on_failure" boolean NOT NULL DEFAULT true,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_policy_config" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "scope" varchar(30) NOT NULL DEFAULT 'global',
                "model_config_id" uuid,
                "max_prompt_length" int NOT NULL DEFAULT 4000,
                "max_negative_prompt_length" int NOT NULL DEFAULT 2000,
                "max_images_per_request" int NOT NULL DEFAULT 4,
                "max_reference_images" int NOT NULL DEFAULT 1,
                "max_reference_image_size_mb" int NOT NULL DEFAULT 10,
                "max_concurrent_jobs_per_user" int NOT NULL DEFAULT 1,
                "daily_jobs_per_user" int NOT NULL DEFAULT 100,
                "allow_public_url_reference" boolean NOT NULL DEFAULT true,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_prompt_template" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "title" varchar(120) NOT NULL,
                "category" varchar(80) NOT NULL DEFAULT 'default',
                "prompt" text NOT NULL,
                "negative_prompt" text,
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "cover_image_url" varchar(1000),
                "enabled" boolean NOT NULL DEFAULT true,
                "sort_order" int NOT NULL DEFAULT 0,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);
    }

    private async ensureGenerationTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_generation" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "mode" varchar(30) NOT NULL DEFAULT 'text-to-image',
                "status" varchar(30) NOT NULL DEFAULT 'pending',
                "billing_status" varchar(30) NOT NULL DEFAULT 'pending',
                "request_key" varchar(100),
                "model_config_id" uuid,
                "prompt" text NOT NULL DEFAULT '',
                "negative_prompt" text,
                "reference_image_url" text,
                "reference_image_file_id" varchar(100),
                "model_id" varchar(100) NOT NULL DEFAULT '',
                "model_name" varchar(100),
                "provider" varchar(100),
                "base_url" varchar(500),
                "size" varchar(30) NOT NULL DEFAULT '1024x1024',
                "n" int NOT NULL DEFAULT 1,
                "quality" varchar(30),
                "style" varchar(30),
                "response_format" varchar(30) NOT NULL DEFAULT 'b64_json',
                "api_mode" varchar(30),
                "request_policy" varchar(30),
                "source_images" jsonb NOT NULL DEFAULT '[]',
                "mask_image" jsonb,
                "output_format" varchar(30),
                "background" varchar(30),
                "output_compression" int,
                "input_fidelity" varchar(30),
                "moderation" varchar(30),
                "seed" varchar(100),
                "steps" int,
                "cfg_scale" double precision,
                "result_images" jsonb NOT NULL DEFAULT '[]',
                "raw_request" jsonb,
                "raw_response" jsonb,
                "error_message" text,
                "failure_code" varchar(100),
                "failure_category" varchar(100),
                "progress" int NOT NULL DEFAULT 0,
                "storage_files" jsonb NOT NULL DEFAULT '[]',
                "raw_events" jsonb NOT NULL DEFAULT '[]',
                "billing_amount" numeric(10,2) NOT NULL DEFAULT 0,
                "started_at" timestamp,
                "completed_at" timestamp,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        const columns = [
            `"mode" varchar(30) NOT NULL DEFAULT 'text-to-image'`,
            `"billing_status" varchar(30) NOT NULL DEFAULT 'pending'`,
            `"request_key" varchar(100)`,
            `"model_config_id" uuid`,
            `"negative_prompt" text`,
            `"reference_image_file_id" varchar(100)`,
            `"api_mode" varchar(30)`,
            `"request_policy" varchar(30)`,
            `"source_images" jsonb NOT NULL DEFAULT '[]'`,
            `"mask_image" jsonb`,
            `"output_format" varchar(30)`,
            `"background" varchar(30)`,
            `"output_compression" int`,
            `"input_fidelity" varchar(30)`,
            `"moderation" varchar(30)`,
            `"seed" varchar(100)`,
            `"steps" int`,
            `"cfg_scale" double precision`,
            `"failure_code" varchar(100)`,
            `"failure_category" varchar(100)`,
            `"progress" int NOT NULL DEFAULT 0`,
            `"storage_files" jsonb NOT NULL DEFAULT '[]'`,
            `"raw_events" jsonb NOT NULL DEFAULT '[]'`,
        ];

        for (const column of columns) {
            await this.dataSource.query(`
                ALTER TABLE "echoflow_image"."image_generation"
                ADD COLUMN IF NOT EXISTS ${column}
            `);
        }
    }

    private async ensureIndexes(): Promise<void> {
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_model_config_ai_model_id" ON "echoflow_image"."image_model_config" ("ai_model_id")`);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_billing_rule_model_config_id" ON "echoflow_image"."image_billing_rule" ("model_config_id")`);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_policy_config_scope_model" ON "echoflow_image"."image_policy_config" ("scope", "model_config_id")`);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_prompt_template_enabled" ON "echoflow_image"."image_prompt_template" ("enabled", "sort_order")`);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_generation_model_config_id" ON "echoflow_image"."image_generation" ("model_config_id")`);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_generation_user_status_created" ON "echoflow_image"."image_generation" ("user_id", "status", "created_at")`);

        const duplicateRows = await this.dataSource.query(`
            SELECT "user_id", "request_key", COUNT(*)::int AS count
            FROM "echoflow_image"."image_generation"
            WHERE "request_key" IS NOT NULL
            GROUP BY "user_id", "request_key"
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

        if (duplicateRows.length > 0) {
            this.logger.warn("Skipped unique requestKey index because duplicate generation records already exist");
            return;
        }

        await this.dataSource.query(`DROP INDEX IF EXISTS "echoflow_image"."idx_image_generation_user_request_key"`);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_image_generation_user_request_key"
            ON "echoflow_image"."image_generation" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL
        `);
    }
}
