import type { QueryRunner } from "@buildingai/db/typeorm";

export class AddContractTaskRevision1781539200002 {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_generation_tasks" ADD COLUMN IF NOT EXISTS "revision" int NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_generation_tasks" ADD COLUMN IF NOT EXISTS "processing_attempt_id" varchar(80)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "echoflow_contract_generation"."contract_generation_tasks" DROP COLUMN IF EXISTS "revision"`);
    }
}
