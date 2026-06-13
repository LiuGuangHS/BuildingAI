import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, IsUUID } from "class-validator";

import type { VideoBillingMultipliers } from "../../../db/entities/video-billing-rule.entity";

export class QueryVideoBillingRuleDto extends PaginationDto {
    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;
}

export class SaveVideoBillingRuleDto {
    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @IsOptional()
    baseCost?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @IsOptional()
    perSecondCost?: number;

    @IsObject()
    @IsOptional()
    resolutionMultipliers?: VideoBillingMultipliers;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @IsOptional()
    minimumCost?: number;

    @IsBoolean()
    @IsOptional()
    refundOnFailure?: boolean;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class EstimateVideoBillingDto {
    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;

    @IsString()
    @IsOptional()
    model?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsNumber()
    @IsOptional()
    duration?: number;

    @IsString()
    @IsOptional()
    resolution?: string;
}
