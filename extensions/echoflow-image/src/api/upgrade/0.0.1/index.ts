import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureConfigTables();
        await this.ensureGenerationTable();
        await this.ensureIndexes();
        await this.backfillSourceImages();
        await this.cleanupOrphanModelScopedRules();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Image initial database setup completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_image"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensureConfigTables(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_image"."image_model_config" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "ai_model_id" uuid,
                "provider" varchar(50) NOT NULL DEFAULT 'echoflow-api',
                "model" varchar(100),
                "external_model_id" varchar(100) NOT NULL DEFAULT '',
                "request_contract" varchar(50) NOT NULL DEFAULT 'responses',
                "display_name" varchar(120) NOT NULL,
                "description" text,
                "enabled" boolean NOT NULL DEFAULT true,
                "visible_to_user" boolean NOT NULL DEFAULT true,
                "capabilities" jsonb NOT NULL DEFAULT '{}',
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "allowed_params" jsonb NOT NULL DEFAULT '{}',
                "endpoints" jsonb NOT NULL DEFAULT '[]',
                "sort_order" int NOT NULL DEFAULT 0,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);
        await this.ensureColumn("image_model_config", "ai_model_id", "uuid");
        await this.ensureColumn("image_model_config", "provider", "varchar(50) NOT NULL DEFAULT 'echoflow-api'");
        await this.ensureColumn("image_model_config", "model", "varchar(100)");
        await this.ensureColumn("image_model_config", "external_model_id", "varchar(100) NOT NULL DEFAULT ''");
        await this.ensureColumn("image_model_config", "request_contract", "varchar(50) NOT NULL DEFAULT 'responses'");
        await this.ensureColumn("image_model_config", "visible_to_user", "boolean NOT NULL DEFAULT true");
        await this.ensureColumn("image_model_config", "capabilities", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_model_config", "default_params", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_model_config", "allowed_params", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_model_config", "endpoints", "jsonb NOT NULL DEFAULT '[]'");
        await this.ensureColumn("image_model_config", "sort_order", "int NOT NULL DEFAULT 0");
        await this.dataSource.query(`ALTER TABLE "echoflow_image"."image_model_config" ALTER COLUMN "ai_model_id" DROP NOT NULL`);

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
        await this.ensureColumn("image_billing_rule", "text_to_image_multiplier", "numeric(10,2) NOT NULL DEFAULT 1");
        await this.ensureColumn("image_billing_rule", "image_to_image_multiplier", "numeric(10,2) NOT NULL DEFAULT 1.5");
        await this.ensureColumn("image_billing_rule", "quality_multipliers", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_billing_rule", "size_multipliers", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_billing_rule", "count_multiplier_enabled", "boolean NOT NULL DEFAULT true");
        await this.ensureColumn("image_billing_rule", "refund_on_failure", "boolean NOT NULL DEFAULT true");

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
                "allow_public_url_reference" boolean NOT NULL DEFAULT false,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);
        await this.ensureColumn("image_policy_config", "max_negative_prompt_length", "int NOT NULL DEFAULT 2000");
        await this.ensureColumn("image_policy_config", "max_images_per_request", "int NOT NULL DEFAULT 4");
        await this.ensureColumn("image_policy_config", "max_reference_images", "int NOT NULL DEFAULT 1");
        await this.ensureColumn("image_policy_config", "max_reference_image_size_mb", "int NOT NULL DEFAULT 10");
        await this.ensureColumn("image_policy_config", "max_concurrent_jobs_per_user", "int NOT NULL DEFAULT 1");
        await this.ensureColumn("image_policy_config", "daily_jobs_per_user", "int NOT NULL DEFAULT 100");
        await this.ensureColumn("image_policy_config", "allow_public_url_reference", "boolean NOT NULL DEFAULT false");

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
        await this.ensureColumn("image_prompt_template", "negative_prompt", "text");
        await this.ensureColumn("image_prompt_template", "default_params", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("image_prompt_template", "cover_image_url", "varchar(1000)");
        await this.ensureColumn("image_prompt_template", "enabled", "boolean NOT NULL DEFAULT true");
        await this.ensureColumn("image_prompt_template", "sort_order", "int NOT NULL DEFAULT 0");
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
        await this.ensureColumn("image_generation", "api_mode", "varchar(30)");
        await this.ensureColumn("image_generation", "request_policy", "varchar(30)");
        await this.ensureColumn("image_generation", "source_images", "jsonb NOT NULL DEFAULT '[]'");
        await this.ensureColumn("image_generation", "mask_image", "jsonb");
        await this.ensureColumn("image_generation", "output_format", "varchar(30)");
        await this.ensureColumn("image_generation", "background", "varchar(30)");
        await this.ensureColumn("image_generation", "output_compression", "int");
        await this.ensureColumn("image_generation", "input_fidelity", "varchar(30)");
        await this.ensureColumn("image_generation", "moderation", "varchar(30)");
        await this.ensureColumn("image_generation", "seed", "varchar(100)");
        await this.ensureColumn("image_generation", "steps", "int");
        await this.ensureColumn("image_generation", "cfg_scale", "double precision");
        await this.ensureColumn("image_generation", "storage_files", "jsonb NOT NULL DEFAULT '[]'");
        await this.ensureColumn("image_generation", "raw_events", "jsonb NOT NULL DEFAULT '[]'");
        await this.ensureColumn("image_generation", "progress", "int NOT NULL DEFAULT 0");
    }

    private async ensureIndexes(): Promise<void> {
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_image_model_config_enabled" ON "echoflow_image"."image_model_config" ("enabled", "visible_to_user")`);
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

    private async backfillSourceImages(): Promise<void> {
        await this.dataSource.query(`
            UPDATE "echoflow_image"."image_generation"
            SET "source_images" = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
                'url', "reference_image_url",
                'fileId', "reference_image_file_id"
            )))
            WHERE COALESCE(jsonb_array_length("source_images"), 0) = 0
              AND ("reference_image_url" IS NOT NULL OR "reference_image_file_id" IS NOT NULL)
        `);
    }

    private async cleanupOrphanModelScopedRules(): Promise<void> {
        await this.dataSource.query(`
            DELETE FROM "echoflow_image"."image_billing_rule" rule
            WHERE rule."model_config_id" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "echoflow_image"."image_model_config" config
                WHERE config."id" = rule."model_config_id"
              )
        `);
        await this.dataSource.query(`
            DELETE FROM "echoflow_image"."image_policy_config" policy
            WHERE policy."model_config_id" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "echoflow_image"."image_model_config" config
                WHERE config."id" = policy."model_config_id"
              )
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/echoflow-image/static/logo.png",
            name: "AI图像工作台",
            identifier: "echoflow-image",
            version: "0.0.1",
            description: "面向创作者的 AI 图像生成与编辑工作台，支持模型配置、参考图创作、历史管理和算力计费。",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/echoflow-image/static/logo.png",
                name: "EchoflowAI Teams",
                homepage: "",
            },
        };

        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await this.dataSource.query(
            `
                INSERT INTO "extension" (
                    "id",
                    "created_at",
                    "updated_at",
                    "icon",
                    "name",
                    "identifier",
                    "version",
                    "description",
                    "type",
                    "is_local",
                    "status",
                    "support_terminal",
                    "author"
                )
                VALUES (
                    uuid_generate_v4(),
                    now(),
                    now(),
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8::plugin_status_enum,
                    $9::jsonb,
                    $10::jsonb
                )
                ON CONFLICT ("identifier") DO UPDATE SET
                    "updated_at" = now(),
                    "icon" = EXCLUDED."icon",
                    "name" = EXCLUDED."name",
                    "version" = EXCLUDED."version",
                    "description" = EXCLUDED."description",
                    "type" = EXCLUDED."type",
                    "is_local" = EXCLUDED."is_local",
                    "status" = EXCLUDED."status",
                    "support_terminal" = EXCLUDED."support_terminal",
                    "author" = EXCLUDED."author"
            `,
            [
                extensionData.icon,
                extensionData.name,
                extensionData.identifier,
                extensionData.version,
                extensionData.description,
                extensionData.type,
                extensionData.isLocal,
                extensionData.status,
                JSON.stringify(extensionData.supportTerminal),
                JSON.stringify(extensionData.author),
            ],
        );
    }

    private async ensureColumn(table: string, column: string, definition: string): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_image"."${table}"
            ADD COLUMN IF NOT EXISTS "${column}" ${definition}
        `);
    }
}
