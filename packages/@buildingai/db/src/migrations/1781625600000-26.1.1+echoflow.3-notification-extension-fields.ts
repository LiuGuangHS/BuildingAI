import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1781625600000 implements MigrationInterface {
    name = "Migration1781625600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "notification"
                ADD COLUMN IF NOT EXISTS "extension_id" character varying(64),
                ADD COLUMN IF NOT EXISTS "scene_code" character varying(96),
                ADD COLUMN IF NOT EXISTS "source_type" character varying(64),
                ADD COLUMN IF NOT EXISTS "source_id" character varying(96),
                ADD COLUMN IF NOT EXISTS "dedupe_key" character varying(160)
        `);
        await queryRunner.query(`
            UPDATE "notification"
            SET
                "extension_id" = COALESCE("extension_id", "data" ->> 'extensionId'),
                "scene_code" = COALESCE("scene_code", "data" ->> 'sceneCode'),
                "source_type" = COALESCE("source_type", "data" ->> 'sourceType'),
                "source_id" = COALESCE("source_id", "data" ->> 'sourceId'),
                "dedupe_key" = COALESCE("dedupe_key", "data" ->> 'dedupeKey')
            WHERE "data" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_extension"
            ON "notification" ("extension_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_scene_code"
            ON "notification" ("scene_code")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_dedupe_key"
            ON "notification" ("dedupe_key")
        `);
        await queryRunner.query(`
            WITH ranked AS (
                SELECT
                    "id",
                    row_number() OVER (
                        PARTITION BY "user_id", "dedupe_key"
                        ORDER BY "created_at" ASC, "id" ASC
                    ) AS rn
                FROM "notification"
                WHERE "dedupe_key" IS NOT NULL
            )
            UPDATE "notification"
            SET "dedupe_key" = NULL
            FROM ranked
            WHERE "notification"."id" = ranked."id"
                AND ranked.rn > 1
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_user_dedupe_key"
            ON "notification" ("user_id", "dedupe_key")
            WHERE "dedupe_key" IS NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "notification_scene"
                ADD COLUMN IF NOT EXISTS "extension_id" character varying(64)
        `);
        await queryRunner.query(`
            UPDATE "notification_scene"
            SET "extension_id" = CASE
                WHEN position('.' in "scene_code") > 0
                    AND split_part("scene_code", '.', 1) LIKE 'echoflow-%'
                THEN split_part("scene_code", '.', 1)
                ELSE "extension_id"
            END
            WHERE "extension_id" IS NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_scene_extension"
            ON "notification_scene" ("extension_id")
        `);

        await queryRunner.query(`
            ALTER TABLE "notification_delivery"
                ADD COLUMN IF NOT EXISTS "extension_id" character varying(64),
                ADD COLUMN IF NOT EXISTS "source_type" character varying(64),
                ADD COLUMN IF NOT EXISTS "source_id" character varying(96)
        `);
        await queryRunner.query(`
            UPDATE "notification_delivery" "delivery"
            SET
                "extension_id" = COALESCE("delivery"."extension_id", "notification"."extension_id"),
                "source_type" = COALESCE(
                    "delivery"."source_type",
                    "notification"."source_type",
                    "delivery"."payload" ->> 'sourceType'
                ),
                "source_id" = COALESCE(
                    "delivery"."source_id",
                    "notification"."source_id",
                    "delivery"."payload" ->> 'sourceId'
                )
            FROM "notification"
            WHERE "delivery"."notification_id" = "notification"."id"
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_extension"
            ON "notification_delivery" ("extension_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_delivery_extension"`);
        await queryRunner.query(`
            ALTER TABLE "notification_delivery"
                DROP COLUMN IF EXISTS "source_id",
                DROP COLUMN IF EXISTS "source_type",
                DROP COLUMN IF EXISTS "extension_id"
        `);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_scene_extension"`);
        await queryRunner.query(`
            ALTER TABLE "notification_scene"
                DROP COLUMN IF EXISTS "extension_id"
        `);

        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notification_user_dedupe_key"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_dedupe_key"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_scene_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_extension"`);
        await queryRunner.query(`
            ALTER TABLE "notification"
                DROP COLUMN IF EXISTS "dedupe_key",
                DROP COLUMN IF EXISTS "source_id",
                DROP COLUMN IF EXISTS "source_type",
                DROP COLUMN IF EXISTS "scene_code",
                DROP COLUMN IF EXISTS "extension_id"
        `);
    }
}
