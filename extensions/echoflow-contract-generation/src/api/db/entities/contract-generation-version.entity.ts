import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, Index, PrimaryGeneratedColumn } from "@buildingai/db/typeorm";

import type { ContractLegalTerm, ContractRiskFinding, ContractScore, ContractSection, RiskActions } from "./contract-generation-task.entity";

@ExtensionEntity({ name: "contract_generation_versions" })
export class ContractGenerationVersion {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id: string;

    @Column({ type: "uuid", comment: "Task ID" })
    @Index()
    taskId: string;

    @Column({ type: "int", comment: "Version number" })
    versionNo: number;

    @Column({ type: "varchar", length: 255, comment: "Contract title" })
    title: string;

    @Column({ type: "text", nullable: true, comment: "Contract summary" })
    summary?: string | null;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Contract sections" })
    sections: ContractSection[];

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Risk findings" })
    riskFindings: ContractRiskFinding[];

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Legal terms" })
    legalTerms: ContractLegalTerm[];

    @Column({ type: "jsonb", nullable: true, comment: "Contract score" })
    score?: ContractScore | null;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Risk action states" })
    riskActions: RiskActions;

    @Column({ type: "varchar", length: 60, comment: "Change type" })
    changeType: string;

    @Column({ type: "varchar", length: 255, nullable: true, comment: "Change summary" })
    changeSummary?: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;
}
