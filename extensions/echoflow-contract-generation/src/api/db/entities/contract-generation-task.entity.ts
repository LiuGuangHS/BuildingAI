import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

export enum ContractGenerationStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    DRAFT = "draft",
    REVIEWING = "reviewing",
    EXPORTING = "exporting",
    SUCCESS = "success",
    FAILED = "failed",
    EXPORT_FAILED = "export_failed",
}

export type ContractParty = {
    name: string;
    role?: string;
    contact?: string;
};

export type ContractSection = {
    id?: string;
    title: string;
    content: string;
    importance?: "normal" | "important" | "critical";
};

export type ContractRiskFinding = {
    id?: string;
    sectionId?: string;
    sourceRevision?: number;
    sourceVersionId?: string;
    stale?: boolean;
    kind?: "missing_fact" | "legal_risk" | "clarity" | "enforceability";
    sectionTitle: string;
    level: "low" | "medium" | "high";
    issue: string;
    suggestion: string;
    replacementText?: string;
    quote?: string;
};

export type ContractLegalTerm = {
    term: string;
    explanation: string;
};

export type ContractScore = {
    overall: number;
    completeness: number;
    riskControl: number;
    clarity: number;
    missingItems: string[];
};

export type RiskActions = Record<string, { status: "accepted" | "ignored"; actedAt: string }>;

@ExtensionEntity({ name: "contract_generation_tasks" })
export class ContractGenerationTask {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id: string;

    @Column({ type: "uuid", comment: "User ID" })
    @Index()
    userId: string;

    @Column({ type: "uuid", comment: "Model ID" })
    @Index()
    modelId: string;

    @Column({ type: "uuid", comment: "Provider ID" })
    @Index()
    providerId: string;

    @Column({ type: "varchar", length: 255, comment: "Contract title" })
    title: string;

    @Column({ type: "varchar", length: 80, comment: "Contract type" })
    @Index()
    contractType: string;

    @Column({ type: "varchar", length: 80, nullable: true, comment: "Industry" })
    @Index()
    industry?: string | null;

    @Column({ type: "varchar", length: 80, nullable: true, comment: "Template ID" })
    templateId?: string | null;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Contract parties" })
    parties: ContractParty[];

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Contract variables" })
    variables: Record<string, unknown>;

    @Column({ type: "text", nullable: true, comment: "Additional prompt" })
    prompt?: string | null;

    @Column({ type: "text", nullable: true, comment: "Generated summary" })
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

    @Column({ type: "varchar", length: 20, default: ContractGenerationStatus.PENDING, comment: "Task status" })
    @Index()
    status: ContractGenerationStatus;

    @Column({ type: "int", default: 0, comment: "Monotonic contract revision" })
    revision: number;

    @Column({ name: "processing_attempt_id", type: "varchar", length: 80, nullable: true, comment: "Execution fencing token" })
    processingAttemptId?: string | null;

    @Column({ type: "varchar", length: 1024, nullable: true, comment: "Generated DOCX result URL" })
    resultUrl?: string | null;

    @Column({ type: "text", nullable: true, comment: "Error message" })
    errorMessage?: string | null;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "Cost credits" })
    costCredits: number;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Provider metadata" })
    providerMetadata: Record<string, unknown>;

    @Column({ type: "jsonb", nullable: true, comment: "Original request payload" })
    requestPayload?: Record<string, unknown> | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
