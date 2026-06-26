import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782474000000 implements MigrationInterface {
    name = "Migration1782474000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
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
                'db-backup',
                'db-backup',
                '',
                '/console/system/db-backup/index',
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "permissions"
                        WHERE "code" = 'backup:list'
                    )
                    THEN 'backup:list'
                    ELSE NULL
                END,
                "system"."id",
                99,
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
        await queryRunner.query(`DELETE FROM "menus" WHERE "code" = 'db-backup'`);
    }
}
