import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import {
    IsBoolean,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Length,
} from "class-validator";

import type {
    ImageModelAllowedParams,
    ImageModelCapabilities,
    ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class QueryModelConfigDto extends PaginationDto {
    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 120)
    @IsOptional()
    keyword?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class CreateModelConfigDto {
    @IsUUID("4")
    mainModelId: string;

    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayNameOverride?: string;

    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayName?: string;

    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 1000)
    @IsOptional()
    descriptionOverride?: string;

    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 1000)
    @IsOptional()
    description?: string;

    @IsUUID("4")
    @IsOptional()
    promptEnhancerModelId?: string | null;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsBoolean()
    @IsOptional()
    visibleToUser?: boolean;

    @IsObject()
    @IsOptional()
    capabilities?: ImageModelCapabilities;

    @IsObject()
    @IsOptional()
    defaultParams?: ImageModelDefaultParams;

    @IsObject()
    @IsOptional()
    allowedParams?: ImageModelAllowedParams;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateModelConfigDto extends CreateModelConfigDto {
    @IsUUID("4")
    @IsOptional()
    declare mainModelId: string;
}
