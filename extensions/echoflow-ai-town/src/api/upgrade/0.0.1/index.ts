import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureAiConfigSchema();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow AI Town initial upgrade completed");
    }

    private async ensureAiConfigSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_ai_town"`);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_ai_town"."town_ai_configs"
            ADD COLUMN IF NOT EXISTS "key" varchar(50)
        `);
        await this.dataSource.query(`
            WITH ranked_configs AS (
                SELECT
                    "id",
                    ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC) AS row_no
                FROM "echoflow_ai_town"."town_ai_configs"
                WHERE "key" IS NULL OR "key" = ''
            ),
            default_state AS (
                SELECT EXISTS (
                    SELECT 1
                    FROM "echoflow_ai_town"."town_ai_configs"
                    WHERE "key" = 'default'
                ) AS has_default
            )
            UPDATE "echoflow_ai_town"."town_ai_configs" AS config
            SET "key" = CASE
                WHEN ranked_configs.row_no = 1 AND NOT default_state.has_default THEN 'default'
                ELSE concat('legacy-', ranked_configs.row_no::text, '-', left(config."id"::text, 8))
            END
            FROM ranked_configs, default_state
            WHERE config."id" = ranked_configs."id"
        `);
        await this.dataSource.query(`
            INSERT INTO "echoflow_ai_town"."town_ai_configs" (
                "key",
                "enabled",
                "temperature",
                "max_tokens",
                "fallback_to_rules",
                "daily_limit_per_user"
            )
            SELECT 'default', false, 0.8, 1200, true, 100
            WHERE NOT EXISTS (
                SELECT 1
                FROM "echoflow_ai_town"."town_ai_configs"
                WHERE "key" = 'default'
            )
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_ai_town"."town_ai_configs"
            ALTER COLUMN "key" SET DEFAULT 'default',
            ALTER COLUMN "key" SET NOT NULL
        `);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_town_ai_configs_key"
            ON "echoflow_ai_town"."town_ai_configs" ("key")
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/echoflow-ai-town/static/icon.png",
            name: "AI乐园小镇｜开放世界",
            identifier: "echoflow-ai-town",
            version: "0.0.1",
            description: "治愈系小镇经营与 AI 趣味玩法应用。经营、探索、NPC 对话和随机事件动态串联，帮助用户打造个性乐园。",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/echoflow-ai-town/static/icon.png",
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
}
