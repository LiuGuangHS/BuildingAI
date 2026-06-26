import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782560400000 implements MigrationInterface {
    name = "Migration1782560400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'notification_delivery'
                        AND column_name = 'notification_id'
                        AND data_type <> 'uuid'
                ) THEN
                    ALTER TABLE "notification_delivery"
                    ALTER COLUMN "notification_id" TYPE uuid USING "notification_id"::uuid;
                END IF;
            END $$
        `);

        await queryRunner.query(`DELETE FROM "menus" WHERE "code" = 'db-backup'`);
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
                '数据库备份',
                'system-db-backup',
                'db-backup',
                '',
                '/console/system/db-backup/index',
                'system:backup:list',
                "system"."id",
                120,
                0,
                2,
                1
            FROM "menus" "system"
            WHERE "system"."code" = 'system'
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
        await queryRunner.query(`DELETE FROM "menus" WHERE "code" = 'system-db-backup'`);
    }
}
