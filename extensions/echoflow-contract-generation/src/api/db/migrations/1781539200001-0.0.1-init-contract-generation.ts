import type { QueryRunner } from "@buildingai/db/typeorm";

export class InitContractGeneration1781539200001 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_contract_generation"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_contract_generation"."contract_generation_configs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "key" varchar(50) NOT NULL DEFAULT 'default',
                "model_id" uuid,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_contract_generation_configs_key" UNIQUE ("key")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_contract_generation"."contract_templates" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(120) NOT NULL,
                "industry" varchar(80) NOT NULL,
                "contract_type" varchar(80) NOT NULL,
                "description" text NOT NULL,
                "fields" jsonb NOT NULL DEFAULT '[]',
                "default_sections" jsonb NOT NULL DEFAULT '[]',
                "prompt_template" text,
                "is_builtin" boolean NOT NULL DEFAULT false,
                "is_active" boolean NOT NULL DEFAULT true,
                "sort_order" int NOT NULL DEFAULT 0,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_contract_generation"."contract_generation_tasks" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "model_id" uuid NOT NULL,
                "provider_id" uuid NOT NULL,
                "title" varchar(255) NOT NULL,
                "contract_type" varchar(80) NOT NULL,
                "industry" varchar(80),
                "template_id" varchar(80),
                "parties" jsonb NOT NULL DEFAULT '[]',
                "variables" jsonb NOT NULL DEFAULT '{}',
                "prompt" text,
                "summary" text,
                "sections" jsonb NOT NULL DEFAULT '[]',
                "risk_findings" jsonb NOT NULL DEFAULT '[]',
                "legal_terms" jsonb NOT NULL DEFAULT '[]',
                "score" jsonb,
                "risk_actions" jsonb NOT NULL DEFAULT '{}',
                "status" varchar(20) NOT NULL DEFAULT 'pending',
                "result_url" varchar(1024),
                "error_message" text,
                "cost_credits" numeric(18,4) NOT NULL DEFAULT 0,
                "provider_metadata" jsonb NOT NULL DEFAULT '{}',
                "request_payload" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_contract_generation"."contract_generation_versions" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "task_id" uuid NOT NULL,
                "version_no" int NOT NULL,
                "title" varchar(255) NOT NULL,
                "summary" text,
                "sections" jsonb NOT NULL DEFAULT '[]',
                "risk_findings" jsonb NOT NULL DEFAULT '[]',
                "legal_terms" jsonb NOT NULL DEFAULT '[]',
                "score" jsonb,
                "risk_actions" jsonb NOT NULL DEFAULT '{}',
                "change_type" varchar(60) NOT NULL,
                "change_summary" varchar(255),
                "created_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_tasks_user_created" ON "echoflow_contract_generation"."contract_generation_tasks" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_tasks_status" ON "echoflow_contract_generation"."contract_generation_tasks" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_versions_task_version" ON "echoflow_contract_generation"."contract_generation_versions" ("task_id", "version_no")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_templates_active_sort" ON "echoflow_contract_generation"."contract_templates" ("is_active", "sort_order")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_contract_generation"."contract_generation_versions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_contract_generation"."contract_generation_tasks"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_contract_generation"."contract_templates"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "echoflow_contract_generation"."contract_generation_configs"`);
    }
}
