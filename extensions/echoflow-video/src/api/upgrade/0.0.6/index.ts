import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

const defaultTemplates = [
    {
        title: "自然风光",
        category: "cinematic",
        prompt: "Sunrise over a calm ocean, waves gently lapping the shore, cinematic lighting, 4k",
        abilityTypes: ["text_to_video"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 40,
    },
    {
        title: "城市夜景",
        category: "cinematic",
        prompt: "A futuristic city at night with neon lights and flying cars, cyberpunk style, 4k",
        abilityTypes: ["text_to_video", "first_frame_i2v"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 30,
    },
    {
        title: "产品展示",
        category: "commerce",
        prompt: "A premium product rotating on a clean studio background, soft light, smooth camera movement",
        abilityTypes: ["first_frame_i2v", "reference_to_video"],
        defaultParams: { duration: 5, resolution: "720P", ratio: "1:1", watermark: true },
        sortOrder: 20,
    },
    {
        title: "视频变换",
        category: "editing",
        prompt: "Transform the input video into a polished cinematic shot while preserving the main subject and motion",
        abilityTypes: ["video_editing", "action_transfer"],
        defaultParams: { duration: 5, resolution: "720P", watermark: true },
        sortOrder: 10,
    },
];

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.ensureSchema();
        await this.ensureTemplateTable();
        await this.ensurePolicyTable();
        await this.seedDefaultTemplates();
        await this.migrateProviderTemplates();
        await this.ensureExtensionRecord();
        this.logger.log("Echoflow Video upgrade to version 0.0.6 completed");
    }

    private async ensureSchema(): Promise<void> {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "echoflow_video"`);
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }

    private async ensureTemplateTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_prompt_template" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "title" varchar(120) NOT NULL,
                "category" varchar(80) NOT NULL DEFAULT 'default',
                "prompt" text NOT NULL,
                "ability_types" jsonb NOT NULL DEFAULT '[]',
                "model_config_id" uuid,
                "default_params" jsonb NOT NULL DEFAULT '{}',
                "cover_image_url" varchar(1000),
                "enabled" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_prompt_template" PRIMARY KEY ("id")
            )
        `);
        await this.dataSource.query(`
            DO $$
            BEGIN
                IF to_regclass('"echoflow_video"."video_model_config"') IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_video_prompt_template_model_config'
                    )
                THEN
                    ALTER TABLE "echoflow_video"."video_prompt_template"
                    ADD CONSTRAINT "fk_video_prompt_template_model_config"
                    FOREIGN KEY ("model_config_id")
                    REFERENCES "echoflow_video"."video_model_config" ("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
        await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_video_prompt_template_enabled"
            ON "echoflow_video"."video_prompt_template" ("enabled", "category")
        `);
    }

    private async ensurePolicyTable(): Promise<void> {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "echoflow_video"."video_policy_config" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "scope" varchar(30) NOT NULL DEFAULT 'global',
                "model_config_id" uuid,
                "max_prompt_length" integer NOT NULL DEFAULT 4000,
                "max_media_items_per_request" integer NOT NULL DEFAULT 5,
                "max_reference_images" integer NOT NULL DEFAULT 4,
                "max_video_size_mb" integer NOT NULL DEFAULT 300,
                "max_image_size_mb" integer NOT NULL DEFAULT 20,
                "max_concurrent_jobs_per_user" integer NOT NULL DEFAULT 3,
                "daily_jobs_per_user" integer NOT NULL DEFAULT 100,
                "allow_public_media_url" boolean NOT NULL DEFAULT true,
                "enabled" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "pk_video_policy_config" PRIMARY KEY ("id")
            )
        `);
        await this.dataSource.query(`
            DO $$
            BEGIN
                IF to_regclass('"echoflow_video"."video_model_config"') IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_video_policy_config_model_config'
                    )
                THEN
                    ALTER TABLE "echoflow_video"."video_policy_config"
                    ADD CONSTRAINT "fk_video_policy_config_model_config"
                    FOREIGN KEY ("model_config_id")
                    REFERENCES "echoflow_video"."video_model_config" ("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
        await this.dataSource.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_video_policy_scope_model"
            ON "echoflow_video"."video_policy_config" ("scope", COALESCE("model_config_id", '00000000-0000-0000-0000-000000000000'::uuid))
        `);
    }

    private async seedDefaultTemplates(): Promise<void> {
        for (const template of defaultTemplates) {
            await this.dataSource.query(
                `
                    INSERT INTO "echoflow_video"."video_prompt_template" (
                        "title",
                        "category",
                        "prompt",
                        "ability_types",
                        "default_params",
                        "enabled",
                        "sort_order"
                    )
                    SELECT $1, $2, $3, $4::jsonb, $5::jsonb, true, $6
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "echoflow_video"."video_prompt_template"
                        WHERE "title" = $1 AND "category" = $2
                    )
                `,
                [
                    template.title,
                    template.category,
                    template.prompt,
                    JSON.stringify(template.abilityTypes),
                    JSON.stringify(template.defaultParams),
                    template.sortOrder,
                ],
            );
        }
    }

    private async migrateProviderTemplates(): Promise<void> {
        const providerTableExists = await this.hasTable("video_provider_config");
        if (!providerTableExists) return;

        const rows: Array<{ templates: Array<{ label?: string; prompt?: string }> }> = await this.dataSource.query(`
            SELECT "templates" FROM "echoflow_video"."video_provider_config"
            WHERE jsonb_array_length(COALESCE("templates", '[]'::jsonb)) > 0
        `);

        for (const row of rows) {
            for (const template of row.templates ?? []) {
                if (!template.label || !template.prompt) continue;
                await this.dataSource.query(
                    `
                        INSERT INTO "echoflow_video"."video_prompt_template" (
                            "title",
                            "category",
                            "prompt",
                            "ability_types",
                            "default_params",
                            "enabled",
                            "sort_order"
                        )
                        SELECT $1, 'legacy', $2, '[]'::jsonb, '{}'::jsonb, true, 0
                        WHERE NOT EXISTS (
                            SELECT 1 FROM "echoflow_video"."video_prompt_template"
                            WHERE "title" = $1 AND "prompt" = $2
                        )
                    `,
                    [template.label.slice(0, 120), template.prompt],
                );
            }
        }
    }

    private async ensureExtensionRecord(): Promise<void> {
        const extensionData = {
            icon: "/static/extensions/default.png",
            name: "Echoflow Video",
            identifier: "echoflow-video",
            version: "0.0.6",
            description: "Echoflow HappyHorse AI video generation plugin",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/static/avatars/buildingai.png",
                name: "BuildingAI Teams",
                homepage: "",
            },
        };

        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await this.dataSource.query(
            `
                INSERT INTO "extension" (
                    "id",
                    "created_at",
                    "updated_at",
                    "icon",
                    "name",
                    "identifier",
                    "version",
                    "description",
                    "type",
                    "is_local",
                    "status",
                    "support_terminal",
                    "author"
                )
                VALUES (
                    uuid_generate_v4(),
                    now(),
                    now(),
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8::plugin_status_enum,
                    $9::jsonb,
                    $10::jsonb
                )
                ON CONFLICT ("identifier") DO UPDATE SET
                    "updated_at" = now(),
                    "icon" = EXCLUDED."icon",
                    "name" = EXCLUDED."name",
                    "version" = EXCLUDED."version",
                    "description" = EXCLUDED."description",
                    "type" = EXCLUDED."type",
                    "is_local" = EXCLUDED."is_local",
                    "status" = EXCLUDED."status",
                    "support_terminal" = EXCLUDED."support_terminal",
                    "author" = EXCLUDED."author"
            `,
            [
                extensionData.icon,
                extensionData.name,
                extensionData.identifier,
                extensionData.version,
                extensionData.description,
                extensionData.type,
                extensionData.isLocal,
                extensionData.status,
                JSON.stringify(extensionData.supportTerminal),
                JSON.stringify(extensionData.author),
            ],
        );
    }

    private async hasTable(tableName: string): Promise<boolean> {
        const tableExists = await this.dataSource.query(
            `SELECT to_regclass($1) AS table_name`,
            [`"echoflow_video"."${tableName}"`],
        );
        return Boolean(tableExists[0]?.table_name);
    }
}
