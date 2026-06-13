import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

import { defaultVideoModelConfigs } from "../../modules/generation/services/model-config.service";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureProviderConfigTable();
        await this.ensureModelConfigTable();
        await this.ensureBillingRuleTable();
        await this.ensureGenerationTable();
        await this.seedDefaultModels();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.5 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensureProviderConfigTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_provider_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'happyhorse',
                "api_key" text NOT NULL DEFAULT '',
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

    private async ensureModelConfigTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_model_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'happyhorse',
                "model" varchar(100) NOT NULL,
                "display_name" varchar(120) NOT NULL,
                "description" text,
                "enabled" boolean NOT NULL DEFAULT true,
                "visible_to_user" boolean NOT NULL DEFAULT true,
                "capabilities" jsonb NOT NULL DEFAULT '{}',
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_model_config" PRIMARY KEY ("id"),
                CONSTRAINT "uq_video_model_config_model" UNIQUE ("model")
            )
        `);

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

    private async ensureGenerationTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_generation" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "model" varchar(50) NOT NULL,
                "status" varchar(30) NOT NULL DEFAULT 'pending',
                "billing_status" varchar(30) NOT NULL DEFAULT 'pending',
                "request_key" varchar(100),
                "task_id" varchar(100),
                "prompt" text NOT NULL DEFAULT '',
                "media" jsonb NOT NULL DEFAULT '[]',
                "parameters" jsonb NOT NULL DEFAULT '{}',
                "video_url" text,
                "error_message" text,
                "raw_request" jsonb,
                "raw_response" jsonb,
                "billing_amount" double precision NOT NULL DEFAULT 0,
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_generation" PRIMARY KEY ("id")
            )
        `);

        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "model_config_id" uuid
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "provider" varchar(50)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "model_name" varchar(120)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "billing_status" varchar(30) NOT NULL DEFAULT 'pending'
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "request_key" varchar(100)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "billing_rule_snapshot" jsonb
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "progress" integer NOT NULL DEFAULT 0
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_gen_user"
            ON "echoflow_video"."video_generation" ("user_id")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_model_config"
            ON "echoflow_video"."video_generation" ("model_config_id")
        `);

        const duplicateRows = await this.dataSource.query(`
            SELECT "user_id", "request_key", COUNT(*)::int AS count
            FROM "echoflow_video"."video_generation"
            WHERE "request_key" IS NOT NULL
            GROUP BY "user_id", "request_key"
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

        if (duplicateRows.length > 0) {
            this.logger.warn("Skipped unique requestKey index because duplicate video generation records already exist");
            return;
        }

        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_generation_user_request_key"
            ON "echoflow_video"."video_generation" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL
        `);
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
                        "sort_order"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
                    ON CONFLICT ("model") DO UPDATE SET
                        "updated_at" = now(),
                        "provider" = EXCLUDED."provider",
                        "display_name" = EXCLUDED."display_name",
                        "description" = EXCLUDED."description",
                        "capabilities" = EXCLUDED."capabilities",
                        "default_params" = EXCLUDED."default_params",
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
                    config.sortOrder,
                ],
            );
        }
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/static/extensions/default.png",
            name: "Echoflow Video",
            identifier: "echoflow-video",
            version: "0.0.5",
            description: "Echoflow HappyHorse AI video generation plugin",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/static/avatars/buildingai.png",
                name: "BuildingAI Teams",
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

    private async hasTable(tableName: string): Promise<boolean> {
        const tableExists = await this.dataSource.query(
            `SELECT to_regclass($1) AS table_name`,
            [`"echoflow_video"."${tableName}"`],
        );
        return Boolean(tableExists[0]?.table_name);
    }
}
