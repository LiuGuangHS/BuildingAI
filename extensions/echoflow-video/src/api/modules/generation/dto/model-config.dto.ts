import { PaginationDto } from "@buildingai/dto";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";

import type {
    VideoModelCapabilities,
    VideoModelDefaultParams,
} from "../../../db/entities/video-model-config.entity";

export class VideoModelEndpointDto {
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

export class QueryVideoModelConfigDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class CreateVideoModelConfigDto {
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

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsBoolean()
    @IsOptional()
    visibleToUser?: boolean;

    @IsObject()
    @IsOptional()
    capabilities?: VideoModelCapabilities;

    @IsObject()
    @IsOptional()
    defaultParams?: VideoModelDefaultParams;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VideoModelEndpointDto)
    @IsOptional()
    endpoints?: VideoModelEndpointDto[];

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateVideoModelConfigDto extends CreateVideoModelConfigDto {
    @IsString()
    @Length(1, 100)
    @IsOptional()
    model: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayName: string;
}
