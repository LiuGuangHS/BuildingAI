import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensurePromptOptimizerColumns();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.8 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensurePromptOptimizerColumns(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_provider_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" varchar(50) NOT NULL DEFAULT 'happyhorse',
                "api_key" text NOT NULL DEFAULT '',
                "base_url" varchar(500) NOT NULL DEFAULT 'https://api.echoflow.cn',
                "request_timeout_ms" integer NOT NULL DEFAULT 120000,
                "test_timeout_ms" integer NOT NULL DEFAULT 15000,
                "max_retries" integer NOT NULL DEFAULT 2,
                "retry_delay_ms" integer NOT NULL DEFAULT 1000,
                "webhook_secret" text,
                "prompt_optimizer_enabled" boolean NOT NULL DEFAULT true,
                "prompt_optimizer_model_id" uuid,
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
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_enabled" boolean NOT NULL DEFAULT true
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_provider_config"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_model_id" uuid
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/static/extensions/default.png",
            name: "Echoflow Video",
            identifier: "echoflow-video",
            version: "0.0.8",
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
}
