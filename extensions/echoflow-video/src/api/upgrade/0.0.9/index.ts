import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureGenerationOperationalColumns();
        await this.ensureConfigAuditTable();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.9 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensureGenerationOperationalColumns(): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "original_prompt" text
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "prompt_optimization_source" varchar(30)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "prompt_optimization_style" varchar(30)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "prompt_optimizer_model_id" uuid
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "failure_category" varchar(50)
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "admin_remark" text
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "status_events" jsonb NOT NULL DEFAULT '[]'
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_failure_category"
            ON "echoflow_video"."video_generation" ("failure_category")
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_generation_billing_status"
            ON "echoflow_video"."video_generation" ("billing_status")
        `);
    }

    private async ensureConfigAuditTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_config_audit" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "action" varchar(80) NOT NULL,
                "operator_id" varchar(80),
                "snapshot" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_config_audit" PRIMARY KEY ("id")
            )
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_config_audit_action"
            ON "echoflow_video"."video_config_audit" ("action", "created_at")
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/static/extensions/default.png",
            name: "Echoflow Video",
            identifier: "echoflow-video",
            version: "0.0.9",
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
                    "id", "created_at", "updated_at", "icon", "name", "identifier",
                    "version", "description", "type", "is_local", "status",
                    "support_terminal", "author"
                )
                VALUES (
                    uuid_generate_v4(), now(), now(), $1, $2, $3, $4, $5, $6, $7,
                    $8::plugin_status_enum, $9::jsonb, $10::jsonb
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
