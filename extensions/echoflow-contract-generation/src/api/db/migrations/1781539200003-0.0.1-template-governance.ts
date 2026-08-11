import type { QueryRunner } from "@buildingai/db/typeorm";

export class TemplateGovernance1781539200003 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" ADD COLUMN IF NOT EXISTS "template_status" varchar(20) NOT NULL DEFAULT 'draft'`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" ADD COLUMN IF NOT EXISTS "template_version_no" int NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" ADD COLUMN IF NOT EXISTS "published_at" timestamptz`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" ADD COLUMN IF NOT EXISTS "offline_at" timestamptz`);
        await queryRunner.query(`UPDATE "echoflow_contract_generation"."contract_templates" SET "template_status" = CASE WHEN "is_active" THEN 'published' ELSE 'offline' END WHERE "template_status" = 'draft'`);
        await queryRunner.query(`WITH ranked AS (SELECT "id", row_number() OVER (PARTITION BY "contract_type", "name" ORDER BY "updated_at" DESC, "id" DESC) AS rank FROM "echoflow_contract_generation"."contract_templates" WHERE "template_status" = 'published' AND "deleted_at" IS NULL) UPDATE "echoflow_contract_generation"."contract_templates" AS template SET "template_status" = 'offline', "is_active" = false, "offline_at" = now() FROM ranked WHERE template."id" = ranked."id" AND ranked.rank > 1`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_templates_published_name_type" ON "echoflow_contract_generation"."contract_templates" ("contract_type", "name") WHERE "template_status" = 'published' AND "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_templates_status_sort" ON "echoflow_contract_generation"."contract_templates" ("template_status", "sort_order") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "echoflow_contract_generation"."idx_contract_templates_status_sort"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "echoflow_contract_generation"."uq_contract_templates_published_name_type"`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" DROP COLUMN IF EXISTS "offline_at"`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" DROP COLUMN IF EXISTS "published_at"`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" DROP COLUMN IF EXISTS "template_version_no"`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_templates" DROP COLUMN IF EXISTS "template_status"`);
    }
}
