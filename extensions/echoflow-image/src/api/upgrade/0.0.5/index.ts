import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        const tableExists = await this.dataSource.query(`
            SELECT to_regclass('"echoflow_image"."image_generation"') AS table_name
        `);

        if (!tableExists[0]?.table_name) {
            this.logger.warn("Skipped Echoflow Image 0.0.5 compatibility upgrade because image_generation table does not exist");
            return;
        }

        await this.ensureGenerationColumns();
        await this.backfillSourceImages();
        this.logger.log("Echoflow Image upgrade to version 0.0.5 completed");
    }

    private async ensureGenerationColumns(): Promise<void> {
        const columns = [
            `"source_images" jsonb NOT NULL DEFAULT '[]'`,
            `"api_mode" varchar(30)`,
            `"request_policy" varchar(30)`,
            `"mask_image" jsonb`,
            `"output_format" varchar(30)`,
            `"background" varchar(30)`,
            `"output_compression" int`,
            `"input_fidelity" varchar(30)`,
            `"moderation" varchar(30)`,
        ];

        for (const column of columns) {
            await this.dataSource.query(`
                ALTER TABLE "echoflow_image"."image_generation"
                ADD COLUMN IF NOT EXISTS ${column}
            `);
        }
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
}
