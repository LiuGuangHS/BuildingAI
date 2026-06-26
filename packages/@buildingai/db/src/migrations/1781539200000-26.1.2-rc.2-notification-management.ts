import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1781539200000 implements MigrationInterface {
    name = "Migration1781539200000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification_scene" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "scene_code" character varying(96) NOT NULL,
                "name" character varying(64) NOT NULL,
                "description" text,
                "is_enabled" boolean NOT NULL DEFAULT true,
                "extension_id" character varying(64),
                "level" character varying(16) NOT NULL DEFAULT 'info',
                "channels" jsonb NOT NULL DEFAULT '["in_app","web_push"]',
                "title_template" character varying(128) NOT NULL,
                "content_template" text,
                "link_url_template" character varying(512),
                "wechat_template" jsonb DEFAULT '{}',
                "user_configurable" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_notification_scene_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_notification_scene_code" UNIQUE ("scene_code")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification_delivery" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "notification_id" character varying(36) NOT NULL,
                "user_id" character varying(36) NOT NULL,
                "scene_code" character varying(96) NOT NULL,
                "extension_id" character varying(64),
                "source_type" character varying(64),
                "source_id" character varying(96),
                "channel" character varying(32) NOT NULL,
                "status" character varying(16) NOT NULL DEFAULT 'pending',
                "attempts" integer NOT NULL DEFAULT 0,
                "provider_message_id" character varying(128),
                "error_code" character varying(64),
                "error_message" text,
                "payload" jsonb DEFAULT '{}',
                "sent_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_notification_delivery_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_notification"
            ON "notification_delivery" ("notification_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_channel_status"
            ON "notification_delivery" ("channel", "status")
        `);
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
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_user_dedupe_key"
            ON "notification" ("user_id", "dedupe_key")
            WHERE "dedupe_key" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_scene_extension"
            ON "notification_scene" ("extension_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_extension"
            ON "notification_delivery" ("extension_id")
        `);

        await queryRunner.query(`
            INSERT INTO "menus" (
                "name",
                "code",
                "path",
                "icon",
                "component",
                "permissionCode",
                "parentId",
                "sort",
                "isHidden",
                "type",
                "sourceType"
            )
            SELECT
                '通知管理',
                'notification-management',
                'notification-management',
                '',
                '/console/notice/notification-management/index',
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "permissions"
                        WHERE "code" = 'notification:notification-scenes-list'
                    )
                    THEN 'notification:notification-scenes-list'
                    ELSE NULL
                END,
                "notice"."id",
                0,
                0,
                2,
                1
            FROM "menus" "notice"
            WHERE "notice"."code" = 'notice'
            ON CONFLICT ("code") DO UPDATE SET
                "name" = EXCLUDED."name",
                "path" = EXCLUDED."path",
                "component" = EXCLUDED."component",
                "permissionCode" = EXCLUDED."permissionCode",
                "parentId" = EXCLUDED."parentId",
                "sort" = EXCLUDED."sort",
                "isHidden" = EXCLUDED."isHidden",
                "type" = EXCLUDED."type",
                "sourceType" = EXCLUDED."sourceType",
                "updated_at" = now()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "menus" WHERE "code" = 'notification-management'`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_delivery_extension"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_delivery"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_scene_extension"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_scene"`);
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
