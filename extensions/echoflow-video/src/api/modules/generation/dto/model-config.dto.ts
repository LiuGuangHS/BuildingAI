import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Length } from "class-validator";

import type { VideoModelCapabilities, VideoModelDefaultParams } from "../../../db/entities/video-model-config.entity";

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
    @IsUUID("4")
    mainModelId: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayNameOverride?: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayName?: string;

    @IsString()
    @IsOptional()
    descriptionOverride?: string;

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
    @IsUUID("4")
    @IsOptional()
    declare mainModelId: string;
}
