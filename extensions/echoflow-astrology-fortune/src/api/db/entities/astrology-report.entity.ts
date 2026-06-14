import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

export enum AstrologyReportStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    SUCCESS = "success",
    FAILED = "failed",
}

export enum AstrologyReportType {
    PROFILE = "profile",
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    PERSONALITY = "personality",
    LOVE = "love",
    CAREER = "career",
    WEALTH = "wealth",
    RELATIONSHIP = "relationship",
    COMPATIBILITY = "compatibility",
    DECISION = "decision",
}

export type AstrologyReportResult = {
    title: string;
    summary: string;
    scores?: Record<string, number>;
    keywords?: string[];
    lucky?: {
        color?: string;
        number?: number;
        direction?: string;
        timeRange?: string;
    };
    sections?: Array<{ heading: string; content: string }>;
    actions?: string[];
    warnings?: string[];
    closing?: string;
};

@ExtensionEntity({ name: "astrology_reports" })
export class AstrologyReport {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id: string;

    @Column({ type: "uuid", comment: "User ID" })
    @Index()
    userId: string;

    @Column({ type: "uuid", nullable: true, comment: "Profile ID" })
    @Index()
    profileId?: string | null;

    @Column({ type: "uuid", comment: "Model ID" })
    @Index()
    modelId: string;

    @Column({ type: "uuid", comment: "Provider ID" })
    @Index()
    providerId: string;

    @Column({ type: "varchar", length: 30, comment: "Report type" })
    @Index()
    reportType: AstrologyReportType;

    @Column({ type: "text", nullable: true, comment: "User question" })
    question?: string | null;

    @Column({ type: "jsonb", nullable: true, comment: "Target profile for compatibility" })
    targetProfile?: Record<string, unknown> | null;

    @Column({ type: "varchar", length: 20, default: AstrologyReportStatus.PENDING, comment: "Report status" })
    @Index()
    status: AstrologyReportStatus;

    @Column({ type: "jsonb", nullable: true, comment: "Structured report result" })
    result?: AstrologyReportResult | null;

    @Column({ type: "text", nullable: true, comment: "Markdown report text" })
    resultText?: string | null;

    @Column({ type: "int", nullable: true, comment: "Overall score" })
    score?: number | null;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Report tags" })
    tags: string[];

    @Column({ type: "boolean", default: false, comment: "Favorite flag" })
    @Index()
    isFavorite: boolean;

    @Column({ type: "decimal", precision: 18, scale: 4, default: 0, comment: "Cost credits" })
    costCredits: number;

    @Column({ type: "text", nullable: true, comment: "Error message" })
    errorMessage?: string | null;

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
