import { ExtensionEntity } from "@buildingai/core/decorators";
import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "@buildingai/db/typeorm";

export type ContractTemplateField = {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select";
    required?: boolean;
    placeholder?: string;
    options?: string[];
};

@ExtensionEntity({ name: "contract_templates" })
export class ContractTemplateEntity {
    @PrimaryGeneratedColumn("uuid")
    @Index()
    id: string;

    @Column({ type: "varchar", length: 120, comment: "Template name" })
    name: string;

    @Column({ type: "varchar", length: 80, comment: "Industry" })
    @Index()
    industry: string;

    @Column({ type: "varchar", length: 80, comment: "Contract type" })
    @Index()
    contractType: string;

    @Column({ type: "text", comment: "Template description" })
    description: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Template fields" })
    fields: ContractTemplateField[];

    @Column({ type: "jsonb", default: () => "'[]'", comment: "Default section titles" })
    defaultSections: string[];

    @Column({ type: "text", nullable: true, comment: "Extra prompt template" })
    promptTemplate?: string | null;

    @Column({ type: "boolean", default: false, comment: "Whether template is synced from builtin templates" })
    isBuiltin: boolean;

    @Column({ type: "boolean", default: true, comment: "Whether template is active" })
    @Index()
    isActive: boolean;

    @Column({ type: "int", default: 0, comment: "Sort order" })
    sortOrder: number;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deletedAt?: Date | null;
}
