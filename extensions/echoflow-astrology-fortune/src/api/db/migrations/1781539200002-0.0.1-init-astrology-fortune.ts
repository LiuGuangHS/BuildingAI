import type { QueryRunner } from "@buildingai/db/typeorm";

export class InitAstrologyFortune1781539200002 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_astrology_fortune"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_astrology_fortune"."astrology_fortune_settings" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "default_model_id" uuid,
                "daily_price" numeric(18,4) NOT NULL DEFAULT 0,
                "report_price" numeric(18,4) NOT NULL DEFAULT 0,
                "compatibility_price" numeric(18,4) NOT NULL DEFAULT 0,
                "decision_price" numeric(18,4) NOT NULL DEFAULT 0,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_astrology_fortune"."astrology_profiles" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "name" varchar(120) NOT NULL,
                "gender" varchar(20),
                "birth_date" date NOT NULL,
                "birth_time" varchar(20),
                "birth_place" varchar(120),
                "zodiac_sign" varchar(20) NOT NULL,
                "moon_sign" varchar(20),
                "rising_sign" varchar(20),
                "chinese_zodiac" varchar(20) NOT NULL,
                "personality_snapshot" jsonb NOT NULL DEFAULT '{}',
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_astrology_fortune"."astrology_reports" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "profile_id" uuid,
                "model_id" uuid NOT NULL,
                "provider_id" uuid NOT NULL,
                "report_type" varchar(30) NOT NULL,
                "question" text,
                "target_profile" jsonb,
                "status" varchar(20) NOT NULL DEFAULT 'pending',
                "result" jsonb,
                "result_text" text,
                "score" int,
                "tags" jsonb NOT NULL DEFAULT '[]',
                "is_favorite" boolean NOT NULL DEFAULT false,
                "cost_credits" numeric(18,4) NOT NULL DEFAULT 0,
                "error_message" text,
                "provider_metadata" jsonb NOT NULL DEFAULT '{}',
                "request_payload" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_astrology_profiles_user_created" ON "echoflow_astrology_fortune"."astrology_profiles" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_astrology_reports_user_created" ON "echoflow_astrology_fortune"."astrology_reports" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_astrology_reports_status" ON "echoflow_astrology_fortune"."astrology_reports" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_astrology_reports_profile" ON "echoflow_astrology_fortune"."astrology_reports" ("profile_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_astrology_fortune"."astrology_reports"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_astrology_fortune"."astrology_profiles"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_astrology_fortune"."astrology_fortune_settings"`);
    }
}
