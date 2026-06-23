import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

import { defaultVideoModelConfigs } from "../../modules/generation/services/model-config.service";

const defaultVideoPromptTemplates = [
    {
        title: "自然风光",
        category: "cinematic",
        prompt: "Sunrise over a calm ocean, waves gently lapping the shore, cinematic lighting, 4k",
        abilityTypes: ["text_to_video"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 40,
    },
    {
        title: "城市夜景",
        category: "cinematic",
        prompt: "A futuristic city at night with neon lights and flying cars, cyberpunk style, 4k",
        abilityTypes: ["text_to_video", "first_frame_i2v"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 30,
    },
    {
        title: "产品展示",
        category: "commerce",
        prompt: "A premium product rotating on a clean studio background, soft light, smooth camera movement",
        abilityTypes: ["first_frame_i2v", "reference_to_video"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "1:1", watermark: true },
        sortOrder: 20,
    },
    {
        title: "视频变换",
        category: "editing",
        prompt: "Transform the input video into a polished cinematic shot while preserving the main subject and motion",
        abilityTypes: ["video_editing", "action_transfer"],
        defaultParams: { duration: 5, resolution: "720P", watermark: true },
        sortOrder: 10,
    },
];

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureProviderConfigTable();
        await this.ensureModelConfigTable();
        await this.ensureBillingRuleTable();
        await this.ensurePromptTemplateTable();
        await this.ensurePolicyConfigTable();
        await this.ensureGenerationTable();
        await this.ensureConfigAuditTable();
        await this.ensurePromptOptimizationTable();
        await this.seedDefaultModels();
        await this.seedDefaultTemplates();
        await this.migrateProviderTemplates();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video initial database setup completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    }

    private async ensureProviderConfigTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_provider_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'happyhorse',
                "webhook_secret_id" uuid,
                "webhook_secret_name" varchar(120),
                "prompt_optimizer_enabled" boolean NOT NULL DEFAULT true,
                "prompt_optimizer_model_id" uuid,
                "prompt_optimizer_allowed_model_ids" jsonb NOT NULL DEFAULT '[]',
                "templates" jsonb NOT NULL DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_provider_config" PRIMARY KEY ("id"),
                CONSTRAINT "uq_video_provider_config_provider" UNIQUE ("provider")
            )
        `);
        await this.ensureColumn("video_provider_config", "webhook_secret_id", "uuid");
        await this.ensureColumn("video_provider_config", "webhook_secret_name", "varchar(120)");
        await this.dropColumnIfExists("video_provider_config", "webhook_secret");
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ALTER COLUMN "provider" SET DEFAULT 'happyhorse'
        `);
        await this.ensureColumn("video_provider_config", "prompt_optimizer_enabled", "boolean NOT NULL DEFAULT true");
        await this.ensureColumn("video_provider_config", "prompt_optimizer_model_id", "uuid");
        await this.ensureColumn("video_provider_config", "prompt_optimizer_allowed_model_ids", "jsonb NOT NULL DEFAULT '[]'");
        await this.dropColumnIfExists("video_provider_config", "prompt_optimizer_billing_enabled");
        await this.dropColumnIfExists("video_provider_config", "prompt_optimizer_billing_power");
        await this.dropColumnIfExists("video_provider_config", "prompt_optimizer_billing_tokens");
        await this.dropColumnIfExists("video_provider_config", "prompt_optimizer_estimated_tokens");
        await this.dropColumnIfExists("video_provider_config", "enabled");
        await this.ensureColumn("video_provider_config", "templates", "jsonb NOT NULL DEFAULT '[]'");
    }

    private async ensureModelConfigTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_model_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'echoflow-api',
                "model" varchar(100) NOT NULL,
                "display_name" varchar(120) NOT NULL,
                "description" text,
                "enabled" boolean NOT NULL DEFAULT true,
                "visible_to_user" boolean NOT NULL DEFAULT true,
                "capabilities" jsonb NOT NULL DEFAULT '{}',
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "endpoints" jsonb NOT NULL DEFAULT '[]',
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_model_config" PRIMARY KEY ("id"),
                CONSTRAINT "uq_video_model_config_model" UNIQUE ("model")
            )
        `);
        await this.ensureColumn("video_model_config", "endpoints", "jsonb NOT NULL DEFAULT '[]'");
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_model_config_enabled"
            ON "echoflow_video"."video_model_config" ("enabled", "visible_to_user")
        `);
    }

    private async ensureBillingRuleTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_billing_rule" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "model_config_id" uuid,
                "base_cost" numeric(10,2) NOT NULL DEFAULT 0,
                "per_second_cost" numeric(10,2) NOT NULL DEFAULT 2,
                "resolution_multipliers" jsonb NOT NULL DEFAULT '{}',
                "minimum_cost" numeric(10,2) NOT NULL DEFAULT 1,
                "refund_on_failure" boolean NOT NULL DEFAULT true,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_billing_rule" PRIMARY KEY ("id"),
                CONSTRAINT "fk_video_billing_rule_model_config" FOREIGN KEY ("model_config_id")
                    REFERENCES "echoflow_video"."video_model_config" ("id") ON DELETE SET NULL
            )
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_billing_rule_model_config"
            ON "echoflow_video"."video_billing_rule" ("model_config_id")
        `);
    }

    private async ensurePromptTemplateTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_prompt_template" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "title" varchar(120) NOT NULL,
                "category" varchar(80) NOT NULL DEFAULT 'default',
                "prompt" text NOT NULL,
                "ability_types" jsonb NOT NULL DEFAULT '[]',
                "model_config_id" uuid,
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "cover_image_url" varchar(1000),
                "enabled" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_prompt_template" PRIMARY KEY ("id")
            )
        `);
        await this.ensureColumn("video_prompt_template", "ability_types", "jsonb NOT NULL DEFAULT '[]'");
        await this.copyColumnIfExists("video_prompt_template", "applicable_models", "ability_types", "[]");
        await this.ensureColumn("video_prompt_template", "model_config_id", "uuid");
        await this.ensureColumn("video_prompt_template", "default_params", "jsonb NOT NULL DEFAULT '{}'");
        await this.ensureColumn("video_prompt_template", "cover_image_url", "varchar(1000)");
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_prompt_template_enabled"
            ON "echoflow_video"."video_prompt_template" ("enabled", "sort_order")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_prompt_template_enabled_category"
            ON "echoflow_video"."video_prompt_template" ("enabled", "category")
        `);
    }

    private async ensurePolicyConfigTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_policy_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "scope" varchar(30) NOT NULL DEFAULT 'global',
                "model_config_id" uuid,
                "max_prompt_length" integer NOT NULL DEFAULT 4000,
                "max_media_items_per_request" integer NOT NULL DEFAULT 5,
                "max_reference_images" integer NOT NULL DEFAULT 4,
                "max_video_size_mb" integer NOT NULL DEFAULT 300,
                "max_image_size_mb" integer NOT NULL DEFAULT 20,
                "max_concurrent_jobs_per_user" integer NOT NULL DEFAULT 3,
                "daily_jobs_per_user" integer NOT NULL DEFAULT 100,
                "allow_public_media_url" boolean NOT NULL DEFAULT false,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_policy_config" PRIMARY KEY ("id")
            )
        `);
        await this.ensureColumn("video_policy_config", "max_media_items_per_request", "integer NOT NULL DEFAULT 5");
        await this.copyColumnIfExists("video_policy_config", "max_media_per_request", "max_media_items_per_request", "5");
        await this.ensureColumn("video_policy_config", "max_reference_images", "integer NOT NULL DEFAULT 4");
        await this.ensureColumn("video_policy_config", "max_video_size_mb", "integer NOT NULL DEFAULT 300");
        await this.copyColumnIfExists("video_policy_config", "max_media_size_mb", "max_video_size_mb", "300");
        await this.ensureColumn("video_policy_config", "max_image_size_mb", "integer NOT NULL DEFAULT 20");
        await this.ensureColumn("video_policy_config", "allow_public_media_url", "boolean NOT NULL DEFAULT false");
        await this.ensureColumn("video_policy_config", "max_concurrent_jobs_per_user", "integer NOT NULL DEFAULT 3");
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_policy_config_scope_model"
            ON "echoflow_video"."video_policy_config" ("scope", "model_config_id")
        `);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_policy_scope_model"
            ON "echoflow_video"."video_policy_config" ("scope", COALESCE("model_config_id", '00000000-0000-0000-0000-000000000000'::uuid))
        `);
    }

    private async ensureGenerationTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_generation" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "model" varchar(50) NOT NULL,
                "model_config_id" uuid,
                "provider" varchar(50),
                "model_name" varchar(120),
                "status" varchar(30) NOT NULL DEFAULT 'pending',
                "billing_status" varchar(30) NOT NULL DEFAULT 'pending',
                "request_key" varchar(100),
                "task_id" varchar(100),
                "prompt" text NOT NULL DEFAULT '',
                "original_prompt" text,
                "prompt_optimization_source" varchar(30),
                "prompt_optimization_style" varchar(30),
                "prompt_optimizer_model_id" uuid,
                "media" jsonb NOT NULL DEFAULT '[]',
                "parameters" jsonb NOT NULL DEFAULT '{}',
                "video_url" text,
                "error_message" text,
                "failure_category" varchar(50),
                "admin_remark" text,
                "raw_request" jsonb,
                "raw_response" jsonb,
                "billing_rule_snapshot" jsonb,
                "status_events" jsonb NOT NULL DEFAULT '[]',
                "progress" integer NOT NULL DEFAULT 0,
                "billing_amount" double precision NOT NULL DEFAULT 0,
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_generation" PRIMARY KEY ("id")
            )
        `);
        await this.ensureColumn("video_generation", "original_prompt", "text");
        await this.ensureColumn("video_generation", "prompt_optimization_source", "varchar(30)");
        await this.ensureColumn("video_generation", "prompt_optimization_style", "varchar(30)");
        await this.ensureColumn("video_generation", "prompt_optimizer_model_id", "uuid");
        await this.ensureColumn("video_generation", "failure_category", "varchar(50)");
        await this.ensureColumn("video_generation", "admin_remark", "text");
        await this.ensureColumn("video_generation", "status_events", "jsonb NOT NULL DEFAULT '[]'");
        await this.ensureColumn("video_generation", "progress", "integer NOT NULL DEFAULT 0");
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_gen_user"
            ON "echoflow_video"."video_generation" ("user_id")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_model_config"
            ON "echoflow_video"."video_generation" ("model_config_id")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_failure_category"
            ON "echoflow_video"."video_generation" ("failure_category")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_billing_status"
            ON "echoflow_video"."video_generation" ("billing_status")
        `);
        await this.ensureUniqueIndex(
            "echoflow_video",
            "video_generation",
            "uq_video_generation_user_request_key",
        );
    }

    private async ensureConfigAuditTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_config_audit" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "action" varchar(100) NOT NULL,
                "operator_id" varchar(80),
                "snapshot" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_config_audit" PRIMARY KEY ("id")
            )
        `);
        await this.ensureColumn("video_config_audit", "operator_id", "varchar(80)");
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_config_audit"
            ALTER COLUMN "operator_id" TYPE varchar(80) USING "operator_id"::text
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_config_audit_action"
            ON "echoflow_video"."video_config_audit" ("action", "created_at")
        `);
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
        await this.ensureUniqueIndex(
            "echoflow_video",
            "video_prompt_optimization",
            "uq_video_prompt_opt_user_request_key",
        );
    }

    private async ensureUniqueIndex(schema: string, table: string, indexName: string): Promise<void> {
        const duplicateRows = await this.dataSource.query(`
            SELECT "user_id", "request_key", COUNT(*)::int AS count
            FROM "${schema}"."${table}"
            WHERE "request_key" IS NOT NULL
            GROUP BY "user_id", "request_key"
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

        if (duplicateRows.length > 0) {
            this.logger.warn(`Skipped ${indexName} because duplicate requestKey records already exist`);
            return;
        }

        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}"
            ON "${schema}"."${table}" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL
        `);
    }

    private async ensureColumn(table: string, column: string, definition: string): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."${table}"
            ADD COLUMN IF NOT EXISTS "${column}" ${definition}
        `);
    }

    private async dropColumnIfExists(table: string, column: string): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."${table}"
            DROP COLUMN IF EXISTS "${column}"
        `);
    }

    private async copyColumnIfExists(table: string, source: string, target: string, targetDefaultText: string): Promise<void> {
        const rows = await this.dataSource.query(
            `
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'echoflow_video'
                  AND table_name = $1
                  AND column_name = $2
                LIMIT 1
            `,
            [table, source],
        );
        if (rows.length === 0) return;

        await this.dataSource.query(`
            UPDATE "echoflow_video"."${table}"
            SET "${target}" = "${source}"
            WHERE "${source}" IS NOT NULL
              AND ("${target}" IS NULL OR "${target}"::text = $1)
        `, [targetDefaultText]);
    }

    private async seedDefaultModels(): Promise<void> {
        for (const config of defaultVideoModelConfigs) {
            await this.dataSource.query(
                `
                    INSERT INTO "echoflow_video"."video_model_config" (
                        "provider",
                        "model",
                        "display_name",
                        "description",
                        "enabled",
                        "visible_to_user",
                        "capabilities",
                        "default_params",
                        "endpoints",
                        "sort_order"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
                    ON CONFLICT ("model") DO UPDATE SET
                        "updated_at" = now(),
                        "provider" = EXCLUDED."provider",
                        "display_name" = EXCLUDED."display_name",
                        "description" = EXCLUDED."description",
                        "capabilities" = EXCLUDED."capabilities",
                        "default_params" = EXCLUDED."default_params",
                        "endpoints" = CASE
                            WHEN "echoflow_video"."video_model_config"."endpoints" IS NULL
                              OR "echoflow_video"."video_model_config"."endpoints" = '[]'::jsonb
                            THEN EXCLUDED."endpoints"
                            ELSE "echoflow_video"."video_model_config"."endpoints"
                        END,
                        "sort_order" = EXCLUDED."sort_order"
                `,
                [
                    config.provider,
                    config.model,
                    config.displayName,
                    config.description ?? null,
                    config.enabled,
                    config.visibleToUser,
                    JSON.stringify(config.capabilities ?? {}),
                    JSON.stringify(config.defaultParams ?? {}),
                    JSON.stringify(config.endpoints ?? []),
                    config.sortOrder,
                ],
            );
        }
    }

    private async seedDefaultTemplates(): Promise<void> {
        for (const template of defaultVideoPromptTemplates) {
            await this.dataSource.query(
                `
                    INSERT INTO "echoflow_video"."video_prompt_template" (
                        "title",
                        "category",
                        "prompt",
                        "ability_types",
                        "default_params",
                        "enabled",
                        "sort_order"
                    )
                    SELECT $1::varchar(120), $2::varchar(80), $3::text, $4::jsonb, $5::jsonb, true, $6::integer
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "echoflow_video"."video_prompt_template"
                        WHERE "title" = $1::varchar(120) AND "category" = $2::varchar(80)
                    )
                `,
                [
                    template.title,
                    template.category,
                    template.prompt,
                    JSON.stringify(template.abilityTypes),
                    JSON.stringify(template.defaultParams),
                    template.sortOrder,
                ],
            );
        }
    }

    private async migrateProviderTemplates(): Promise<void> {
        const rows: Array<{ templates: Array<{ label?: string; prompt?: string }> }> = await this.dataSource.query(`
            SELECT "templates" FROM "echoflow_video"."video_provider_config"
            WHERE jsonb_array_length(COALESCE("templates", '[]'::jsonb)) > 0
        `);

        for (const row of rows) {
            for (const template of row.templates ?? []) {
                if (!template.label || !template.prompt) continue;
                await this.dataSource.query(
                    `
                        INSERT INTO "echoflow_video"."video_prompt_template" (
                            "title",
                            "category",
                            "prompt",
                            "ability_types",
                            "default_params",
                            "enabled",
                            "sort_order"
                        )
                        SELECT $1::varchar(120), 'legacy'::varchar(80), $2::text, '[]'::jsonb, '{}'::jsonb, true, 0::integer
                        WHERE NOT EXISTS (
                            SELECT 1 FROM "echoflow_video"."video_prompt_template"
                            WHERE "title" = $1::varchar(120) AND "prompt" = $2::text
                        )
                    `,
                    [template.label.slice(0, 120), template.prompt],
                );
            }
        }
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/echoflow-video/static/logo.png",
            name: "EchoFlow 视频生成",
            identifier: "echoflow-video",
            version: "0.0.1",
            description: "面向创作者的 AI 视频生成工作台，支持文生视频、图生视频、视频编辑、任务历史和算力计费。",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/echoflow-video/static/logo.png",
                name: "EchoflowAI Teams",
                homepage: "",
            },
        };

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
}
