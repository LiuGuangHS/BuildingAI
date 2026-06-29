import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSettingColumns();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Astrology Fortune initial upgrade completed");
    }

    private async ensureSettingColumns(): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_astrology_fortune"."astrology_fortune_settings"
            ADD COLUMN IF NOT EXISTS "key" varchar(50) NOT NULL DEFAULT 'default'
        `);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_astrology_fortune_settings_key"
            ON "echoflow_astrology_fortune"."astrology_fortune_settings" ("key")
        `);
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/echoflow-astrology-fortune/static/icon.png",
            name: "星盘运势",
            identifier: "echoflow-astrology-fortune",
            version: "0.0.1",
            description: "输入出生信息，生成个人星盘、运势解读与提问建议。",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/echoflow-astrology-fortune/static/icon.png",
                name: "EchoFlowAI Team",
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
