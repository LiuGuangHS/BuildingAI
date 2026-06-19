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
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_delivery"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_scene"`);
    }
}
