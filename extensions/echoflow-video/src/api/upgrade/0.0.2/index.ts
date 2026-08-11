import { Logger } from "@nestjs/common";
import type { DataSource } from "@buildingai/db/typeorm";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureModelConfigColumns();
        await this.ensureGenerationColumns();
        await this.disableUnboundLegacyModels();
        await this.updateExtensionRecord();
        this.logger.log("Echoflow Video 0.0.2 schema boundary upgrade completed");
    }

    private async ensureModelConfigColumns(): Promise<void> {
        const columns = [
            ["main_model_id", "uuid"],
            ["display_name_override", "varchar(120)"],
            ["description_override", "text"],
            ["visible_to_user", "boolean NOT NULL DEFAULT true"],
            ["capabilities", "jsonb NOT NULL DEFAULT '{}'"],
            ["default_params", "jsonb NOT NULL DEFAULT '{}'"],
            ["sort_order", "integer NOT NULL DEFAULT 0"],
        ] as const;

        for (const [column, definition] of columns) {
            await this.dataSource.query(
                `ALTER TABLE "echoflow_video"."video_model_config" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`,
            );
        }

        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_model_config_main_model"
            ON "echoflow_video"."video_model_config" ("main_model_id")
            WHERE "main_model_id" IS NOT NULL
        `);
    }

    private async ensureGenerationColumns(): Promise<void> {
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_model_config"
            ALTER COLUMN "model" DROP NOT NULL,
            ALTER COLUMN "display_name" DROP NOT NULL
        `);
        await this.dataSource.query(`
            ALTER TABLE "echoflow_video"."video_generation"
            ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
        `);
    }

    private async updateExtensionRecord(): Promise<void> {
        await this.dataSource.query(
            `UPDATE "extension" SET "version" = $1, "updated_at" = now() WHERE "identifier" = $2`,
            ["0.0.2", "echoflow-video"],
        );
    }

    private async disableUnboundLegacyModels(): Promise<void> {
        await this.dataSource.query(`
            UPDATE "echoflow_video"."video_model_config"
            SET "enabled" = false,
                "visible_to_user" = false,
                "updated_at" = now()
            WHERE "main_model_id" IS NULL
               OR COALESCE("capabilities" ->> 'apiContractVerified', 'false') <> 'true'
        `);
    }
}
