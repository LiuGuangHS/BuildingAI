import type { QueryRunner } from "@buildingai/db/typeorm";

export class AddAstrologyReportRequestKey1781539200003 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "echoflow_astrology_fortune"."astrology_reports"
            ADD COLUMN IF NOT EXISTS "request_key" varchar(36)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_astrology_reports_user_request_key"
            ON "echoflow_astrology_fortune"."astrology_reports" ("user_id", "request_key")
            WHERE "request_key" IS NOT NULL AND "deleted_at" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "echoflow_astrology_fortune"."uq_astrology_reports_user_request_key"`);
        await queryRunner.query(`
            ALTER TABLE "echoflow_astrology_fortune"."astrology_reports"
            DROP COLUMN IF EXISTS "request_key"
        `);
    }
}
