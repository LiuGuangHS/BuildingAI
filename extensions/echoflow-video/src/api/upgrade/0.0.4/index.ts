import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.4 completed");
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/static/extensions/default.png",
            name: "Echoflow Video",
            identifier: "echoflow-video",
            version: "0.0.4",
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
        this.logger.log("Upserted Echoflow Video extension registry record");
    }
}
