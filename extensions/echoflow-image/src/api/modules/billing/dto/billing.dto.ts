import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsUUID, Min } from "class-validator";

import { ImageGenerationMode } from "../../../db/entities/image-generation.entity";
import type { ImageBillingMultipliers } from "../../../db/entities/image-billing-rule.entity";

export class QueryBillingRuleDto extends PaginationDto {
    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;
}

export class CreateBillingRuleDto {
    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @Min(0)
    @IsOptional()
    baseCost?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @Min(0)
    @IsOptional()
    textToImageMultiplier?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @Min(0)
    @IsOptional()
    imageToImageMultiplier?: number;

    @IsObject()
    @IsOptional()
    qualityMultipliers?: ImageBillingMultipliers;

    @IsObject()
    @IsOptional()
    sizeMultipliers?: ImageBillingMultipliers;

    @IsBoolean()
    @IsOptional()
    countMultiplierEnabled?: boolean;

    @IsBoolean()
    @IsOptional()
    refundOnFailure?: boolean;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class UpdateBillingRuleDto extends CreateBillingRuleDto {}

export class EstimateBillingDto {
    @IsUUID("4")
    modelConfigId: string;

    @IsEnum(ImageGenerationMode)
    @IsOptional()
    mode?: ImageGenerationMode;

    @IsOptional()
    size?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @Min(1)
    @IsOptional()
    n?: number;

    @IsOptional()
    quality?: string;
}
