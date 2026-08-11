import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

import { ContractGenerationStatus } from "../../../db/entities";

export class ContractSectionDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50000)
    content: string;

    @IsString()
    @IsOptional()
    @IsIn(["normal", "important", "critical"])
    importance?: "normal" | "important" | "critical";
}

export class GenerateContractDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    title: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    templateId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    contractType?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    industry?: string;

    @IsObject()
    @IsOptional()
    variables?: Record<string, unknown>;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    prompt?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    language?: string;

    @IsString()
    @IsOptional()
    @IsIn(["neutral", "favor_party_a", "favor_party_b", "strict", "friendly"])
    stance?: "neutral" | "favor_party_a" | "favor_party_b" | "strict" | "friendly";
}

export class ReviewUploadedContractDto {
    @IsString()
    @IsOptional()
    @MaxLength(120)
    title?: string;

    @IsString()
    @IsNotEmpty()
    @IsUUID("4")
    fileId: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    contractType?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    industry?: string;

    @IsString()
    @IsOptional()
    @IsIn(["neutral", "favor_party_a", "favor_party_b", "strict", "friendly"])
    stance?: "neutral" | "favor_party_a" | "favor_party_b" | "strict" | "friendly";
}

export class ExportContractDto {
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    includeRiskReport?: boolean;

    @IsString()
    @IsOptional()
    @IsIn(["contract", "contract_with_report", "risk_report"])
    exportType?: "contract" | "contract_with_report" | "risk_report";
}

export class UpdateContractConfigDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID("4")
    modelId: string;
}

export class ContractTemplateFieldDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    key: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    label: string;

    @IsString()
    @IsIn(["text", "textarea", "number", "date", "select"])
    type: "text" | "textarea" | "number" | "date" | "select";

    @IsBoolean()
    @IsOptional()
    required?: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    placeholder?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    options?: string[];
}

export class UpsertContractTemplateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    industry: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    contractType: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    description: string;

    @IsArray()
    @ArrayMaxSize(40)
    @ValidateNested({ each: true })
    @Type(() => ContractTemplateFieldDto)
    fields: ContractTemplateFieldDto[];

    @IsArray()
    @ArrayMaxSize(40)
    defaultSections: string[];

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    promptTemplate?: string;

    @IsInt()
    @IsOptional()
    @Type(() => Number)
    sortOrder?: number;
}

export class UpdateContractContentDto {
    @IsInt()
    @Min(0)
    @Transform(({ value }) => (value == null || (typeof value === "string" && value.trim() === "") ? value : Number(value)))
    baseRevision: number;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    title?: string;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    summary?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(80)
    @ValidateNested({ each: true })
    @Type(() => ContractSectionDto)
    sections: ContractSectionDto[];
}

export class UpdateRiskActionDto {
    @IsInt()
    @Min(0)
    @Transform(({ value }) => (value == null || (typeof value === "string" && value.trim() === "") ? value : Number(value)))
    baseRevision: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    riskKey: string;

    @IsString()
    @IsIn(["accepted", "ignored"])
    status: "accepted" | "ignored";

    @IsArray()
    @IsOptional()
    @ArrayMaxSize(80)
    @ValidateNested({ each: true })
    @Type(() => ContractSectionDto)
    sections?: ContractSectionDto[];
}

export class RestoreContractVersionDto {
    @IsInt()
    @Min(0)
    @Transform(({ value }) => (value == null || (typeof value === "string" && value.trim() === "") ? value : Number(value)))
    baseRevision: number;
}

export class RewriteContractClauseDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    sectionTitle: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(12000)
    content: string;

    @IsString()
    @IsOptional()
    @IsIn(["stricter", "favor_party_a", "favor_party_b", "concise", "friendly", "reduce_risk"])
    mode?: "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly" | "reduce_risk";
}

export class QueryContractTaskDto {
    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    @Transform(({ value }) => (value === undefined ? 20 : value))
    pageSize?: number;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    keyword?: string;

    @IsString()
    @IsOptional()
    @IsIn(Object.values(ContractGenerationStatus))
    status?: ContractGenerationStatus;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    userId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    templateId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    contractType?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    modelId?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    providerId?: string;
}
