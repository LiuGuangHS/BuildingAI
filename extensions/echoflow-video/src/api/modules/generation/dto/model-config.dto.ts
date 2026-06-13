import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from "class-validator";

import type {
    VideoModelCapabilities,
    VideoModelDefaultParams,
} from "../../../db/entities/video-model-config.entity";

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
