import { PaginationDto } from "@buildingai/dto";
import { Transform, Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Max,
    Min,
    ValidateNested,
} from "class-validator";

import type {
    ImageModelAllowedParams,
    ImageModelCapabilities,
    ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";

export class ImageModelEndpointDto {
    @IsString()
    @Length(1, 80)
    @IsOptional()
    id?: string;

    @IsString()
    @Length(1, 80)
    name: string;

    @IsString()
    @Length(1, 80)
    @IsOptional()
    secretId?: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    secretName?: string;

    @IsString()
    @Length(1, 500)
    @IsOptional()
    baseUrlOverride?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @Max(100000)
    @IsOptional()
    priority?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(3000)
    @Max(300000)
    @IsOptional()
    requestTimeoutMs?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(3000)
    @Max(60000)
    @IsOptional()
    testTimeoutMs?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @Max(5)
    @IsOptional()
    maxRetries?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(100)
    @Max(10000)
    @IsOptional()
    retryDelayMs?: number;
}

export class QueryModelConfigDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class CreateModelConfigDto {
    @IsString()
    @Length(1, 50)
    @IsOptional()
    provider?: string;

    @IsString()
    @Length(1, 100)
    model: string;

    @IsString()
    @Length(1, 120)
    displayName: string;

    @IsString()
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

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImageModelEndpointDto)
    @IsOptional()
    endpoints?: ImageModelEndpointDto[];

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateModelConfigDto extends CreateModelConfigDto {
    @IsString()
    @Length(1, 100)
    @IsOptional()
    declare model: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    declare displayName: string;
}
