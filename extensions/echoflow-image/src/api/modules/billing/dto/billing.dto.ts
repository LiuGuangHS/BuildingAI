import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

import { ImageGenerationMode } from "../../../db/entities/image-generation.entity";
import type { ImageBillingMultipliers } from "../../../db/entities/image-billing-rule.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class QueryBillingRuleDto extends PaginationDto {
    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    modelConfigId?: string;
}

export class CreateBillingRuleDto {
    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
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
    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    modelConfigId?: string;

    @IsEnum(ImageGenerationMode)
    @IsOptional()
    mode?: ImageGenerationMode;

    @IsString()
    @Length(1, 60)
    @IsOptional()
    size?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @Min(1)
    @IsOptional()
    n?: number;

    @IsString()
    @Length(1, 60)
    @IsOptional()
    quality?: string;
}
