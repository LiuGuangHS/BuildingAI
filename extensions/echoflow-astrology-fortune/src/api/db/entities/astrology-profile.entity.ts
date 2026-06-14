import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

export type AstrologyPersonalitySnapshot = {
    summary?: string;
    keywords?: string[];
    strengths?: string[];
    challenges?: string[];
    emotionalPattern?: string;
    relationshipPattern?: string;
    careerPattern?: string;
};

@ExtensionEntity({ name: "astrology_profiles" })
export class AstrologyProfile {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id: string;

    @Column({ type: "uuid", comment: "User ID" })
    @Index()
    userId: string;

    @Column({ type: "varchar", length: 120, comment: "Profile name" })
    name: string;

    @Column({ type: "varchar", length: 20, nullable: true, comment: "Gender" })
    gender?: string | null;

    @Column({ type: "date", comment: "Birth date" })
    birthDate: string;

    @Column({ type: "varchar", length: 20, nullable: true, comment: "Birth time" })
    birthTime?: string | null;

    @Column({ type: "varchar", length: 120, nullable: true, comment: "Birth place" })
    birthPlace?: string | null;

    @Column({ type: "varchar", length: 20, comment: "Sun zodiac sign" })
    @Index()
    zodiacSign: string;

    @Column({ type: "varchar", length: 20, nullable: true, comment: "Moon zodiac sign" })
    moonSign?: string | null;

    @Column({ type: "varchar", length: 20, nullable: true, comment: "Rising zodiac sign" })
    risingSign?: string | null;

    @Column({ type: "varchar", length: 20, comment: "Chinese zodiac" })
    chineseZodiac: string;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Long-term personality snapshot" })
    personalitySnapshot: AstrologyPersonalitySnapshot;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "Profile metadata" })
    metadata: Record<string, unknown>;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
