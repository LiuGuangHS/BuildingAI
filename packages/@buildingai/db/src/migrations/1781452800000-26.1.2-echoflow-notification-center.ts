import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1781452800000 implements MigrationInterface {
    name = "Migration1781452800000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" character varying(36) NOT NULL,
                "title" character varying(128) NOT NULL,
                "content" text,
                "type" character varying(32) NOT NULL DEFAULT 'system',
                "level" character varying(16) NOT NULL DEFAULT 'info',
                "link_url" character varying(512),
                "data" jsonb DEFAULT '{}',
                "read_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_notification_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_user_id"
            ON "notification" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_notification_user_read"
            ON "notification" ("user_id", "read_at")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "push_subscription" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" character varying(36) NOT NULL,
                "endpoint" text NOT NULL,
                "p256dh" text NOT NULL,
                "auth" text NOT NULL,
                "user_agent" text,
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "is_enabled" boolean NOT NULL DEFAULT true,
                "failure_count" integer NOT NULL DEFAULT 0,
                "last_used_at" TIMESTAMP WITH TIME ZONE,
                "failed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_push_subscription_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_push_subscription_endpoint" UNIQUE ("endpoint")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_push_subscription_user_enabled"
            ON "push_subscription" ("user_id", "is_enabled")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "push_subscription"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification"`);
    }
}
