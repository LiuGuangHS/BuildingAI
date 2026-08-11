import type { DataSource, EntityManager } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

const SCHEMA = "echoflow_contract_generation";
const REPAIR_ID = "contract-generation-0.0.1-schema-repair-v1";

export class Upgrade {
    static readonly supportsSameVersionRepair = true;

    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        const repaired = await this.dataSource.transaction(async (manager) => {
            await manager.query(`SET LOCAL lock_timeout = 3000`);
            await manager.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
            await manager.query(`CREATE TABLE IF NOT EXISTS "${SCHEMA}"."contract_schema_repairs" ("repair_id" varchar(255) PRIMARY KEY, "completed_at" timestamptz NOT NULL DEFAULT now())`);
            await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [REPAIR_ID]);
            const completed = await manager.query(`SELECT 1 FROM "${SCHEMA}"."contract_schema_repairs" WHERE "repair_id" = $1`, [REPAIR_ID]);
            if (completed.length > 0) return false;

            await this.ensureContractSchema(manager);
            await this.ensureExtensionRecord(manager);
            await manager.query(`INSERT INTO "${SCHEMA}"."contract_schema_repairs" ("repair_id") VALUES ($1)`, [REPAIR_ID]);
            return true;
        });

        if (repaired) this.logger.log(`Contract schema repair completed: ${REPAIR_ID}`);
    }

    private async ensureContractSchema(manager: EntityManager): Promise<void> {
        const tables = await manager.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('contract_generation_tasks', 'contract_templates')`, [SCHEMA]);
        if (tables.length !== 2) throw new Error(`Contract schema repair precondition failed: ${REPAIR_ID}`);

        const templateStatusColumn = await manager.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'contract_templates' AND column_name = 'template_status'`, [SCHEMA]);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_generation_tasks" ADD COLUMN IF NOT EXISTS "revision" int NOT NULL DEFAULT 0`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_generation_tasks" ADD COLUMN IF NOT EXISTS "processing_attempt_id" varchar(80)`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ADD COLUMN IF NOT EXISTS "template_status" varchar(20)`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ADD COLUMN IF NOT EXISTS "template_version_no" int NOT NULL DEFAULT 1`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ADD COLUMN IF NOT EXISTS "published_at" timestamptz`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ADD COLUMN IF NOT EXISTS "offline_at" timestamptz`);
        await manager.query(`UPDATE "${SCHEMA}"."contract_generation_tasks" SET "revision" = 0 WHERE "revision" IS NULL`);

        if (templateStatusColumn.length === 0) {
            await manager.query(`UPDATE "${SCHEMA}"."contract_templates" SET "template_status" = CASE WHEN "is_active" THEN 'published' ELSE 'offline' END`);
        } else {
            await manager.query(`UPDATE "${SCHEMA}"."contract_templates" SET "template_status" = CASE WHEN "is_active" THEN 'published' ELSE 'offline' END WHERE "template_status" IS NULL OR "template_status" NOT IN ('draft', 'published', 'offline')`);
        }

        await manager.query(`UPDATE "${SCHEMA}"."contract_templates" SET "template_version_no" = 1 WHERE "template_version_no" IS NULL OR "template_version_no" < 1`);
        await manager.query(`UPDATE "${SCHEMA}"."contract_templates" SET "published_at" = COALESCE("published_at", "updated_at") WHERE "template_status" = 'published'`);
        await manager.query(`UPDATE "${SCHEMA}"."contract_templates" SET "offline_at" = COALESCE("offline_at", "updated_at") WHERE "template_status" = 'offline'`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ALTER COLUMN "template_status" SET DEFAULT 'draft'`);
        await manager.query(`ALTER TABLE "${SCHEMA}"."contract_templates" ALTER COLUMN "template_status" SET NOT NULL`);
        await manager.query(`WITH ranked AS (SELECT "id", row_number() OVER (PARTITION BY "contract_type", "name" ORDER BY "updated_at" DESC, "id" DESC) AS rank FROM "${SCHEMA}"."contract_templates" WHERE "template_status" = 'published' AND "deleted_at" IS NULL) UPDATE "${SCHEMA}"."contract_templates" AS template SET "template_status" = 'offline', "is_active" = false, "offline_at" = now() FROM ranked WHERE template."id" = ranked."id" AND ranked.rank > 1`);
        await manager.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_templates_published_name_type" ON "${SCHEMA}"."contract_templates" ("contract_type", "name") WHERE "template_status" = 'published' AND "deleted_at" IS NULL`);
        await manager.query(`CREATE INDEX IF NOT EXISTS "idx_contract_templates_status_sort" ON "${SCHEMA}"."contract_templates" ("template_status", "sort_order") WHERE "deleted_at" IS NULL`);

        const columns = await manager.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND ((table_name = 'contract_generation_tasks' AND column_name IN ('revision', 'processing_attempt_id')) OR (table_name = 'contract_templates' AND column_name IN ('template_status', 'template_version_no', 'published_at', 'offline_at')))`, [SCHEMA]);
        const indexes = await manager.query(`SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname IN ('uq_contract_templates_published_name_type', 'idx_contract_templates_status_sort')`, [SCHEMA]);
        if (columns.length !== 6 || indexes.length !== 2) throw new Error(`Contract schema repair postcondition failed: ${REPAIR_ID}`);
        const duplicates = await manager.query(`SELECT 1 FROM "${SCHEMA}"."contract_templates" WHERE "template_status" = 'published' AND "deleted_at" IS NULL GROUP BY "contract_type", "name" HAVING COUNT(*) > 1`);
        if (duplicates.length > 0) throw new Error(`Contract schema repair duplicate postcondition failed: ${REPAIR_ID}`);
    }

    private async ensureExtensionRecord(manager: EntityManager): Promise<void> {
        const extensionData = {
            icon: "/echoflow-contract-generation/static/icon.png",
            name: "合同生成",
            identifier: "echoflow-contract-generation",
            version: "0.0.1",
            description: "合同起草与审查插件，支持多行业模板、条款编辑、异步任务队列、风险提示、改写建议与 Word 导出。",
            type: 1,
            isLocal: true,
            status: "1",
            supportTerminal: [1],
            author: {
                avatar: "/echoflow-contract-generation/static/icon.png",
                name: "EchoFlowAI Team",
                homepage: "",
            },
        };

        await manager.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await manager.query(
            `
                INSERT INTO "extension" (
                    "id", "created_at", "updated_at", "icon", "name", "identifier", "version",
                    "description", "type", "is_local", "status", "support_terminal", "author"
                ) VALUES (
                    uuid_generate_v4(), now(), now(), $1, $2, $3, $4, $5, $6, $7,
                    $8::plugin_status_enum, $9::jsonb, $10::jsonb
                )
                ON CONFLICT ("identifier") DO UPDATE SET
                    "updated_at" = now(),
                    "icon" = EXCLUDED."icon",
                    "name" = EXCLUDED."name",
                    "version" = EXCLUDED."version",
                    "description" = EXCLUDED."description",
                    "type" = EXCLUDED."type",
                    "is_local" = EXCLUDED."is_local",
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
}
