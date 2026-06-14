import type { QueryRunner } from "@buildingai/db/typeorm";

export class InitAiTown1781539200003 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_ai_town"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_ai_town"."town_saves" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "name" varchar(120) NOT NULL,
                "level" int NOT NULL DEFAULT 1,
                "coins" int NOT NULL DEFAULT 120,
                "stamina" int NOT NULL DEFAULT 100,
                "day" int NOT NULL DEFAULT 1,
                "mood" varchar(60) NOT NULL DEFAULT '期待',
                "world_state" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_ai_town"."town_characters" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "save_id" uuid NOT NULL,
                "name" varchar(80) NOT NULL,
                "role" varchar(80) NOT NULL,
                "personality" varchar(200) NOT NULL,
                "relationship" int NOT NULL DEFAULT 20,
                "status" varchar(80) NOT NULL DEFAULT '日常',
                "memory" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz,
                CONSTRAINT "fk_town_characters_save" FOREIGN KEY ("save_id") REFERENCES "echoflow_ai_town"."town_saves" ("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_ai_town"."town_events" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "save_id" uuid NOT NULL,
                "type" varchar(60) NOT NULL,
                "title" varchar(160) NOT NULL,
                "content" text NOT NULL,
                "choices" jsonb,
                "result" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz,
                CONSTRAINT "fk_town_events_save" FOREIGN KEY ("save_id") REFERENCES "echoflow_ai_town"."town_saves" ("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_ai_town"."town_ai_configs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "enabled" boolean NOT NULL DEFAULT false,
                "default_model_id" uuid,
                "temperature" double precision NOT NULL DEFAULT 0.8,
                "max_tokens" int NOT NULL DEFAULT 1200,
                "fallback_to_rules" boolean NOT NULL DEFAULT true,
                "daily_limit_per_user" int NOT NULL DEFAULT 100,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_ai_town"."town_ai_call_logs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid,
                "save_id" uuid,
                "type" varchar(40) NOT NULL,
                "model_id" uuid,
                "success" boolean NOT NULL DEFAULT false,
                "fallback_used" boolean NOT NULL DEFAULT false,
                "latency_ms" int NOT NULL DEFAULT 0,
                "error_message" text,
                "usage" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_town_saves_user_created" ON "echoflow_ai_town"."town_saves" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_town_characters_save" ON "echoflow_ai_town"."town_characters" ("save_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_town_events_save_created" ON "echoflow_ai_town"."town_events" ("save_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_town_ai_logs_user_created" ON "echoflow_ai_town"."town_ai_call_logs" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_town_ai_logs_save_created" ON "echoflow_ai_town"."town_ai_call_logs" ("save_id", "created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_ai_town"."town_ai_call_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_ai_town"."town_ai_configs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_ai_town"."town_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_ai_town"."town_characters"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_ai_town"."town_saves"`);
    }
}
