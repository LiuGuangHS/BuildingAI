import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Length } from "class-validator";

import type { VideoAbilityType, VideoModelDefaultParams } from "../../../db/entities/video-model-config.entity";

export class QueryVideoTemplateDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsString()
    @IsOptional()
    abilityType?: VideoAbilityType;

    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;
}

export class CreateVideoTemplateDto {
    @IsString()
    @Length(1, 120)
    title: string;

    @IsString()
    @Length(1, 80)
    @IsOptional()
    category?: string;

    @IsString()
    @Length(1, 4000)
    prompt: string;

    @IsArray()
    @IsOptional()
    abilityTypes?: VideoAbilityType[];

    @IsUUID("4")
    @IsOptional()
    modelConfigId?: string;

    @IsObject()
    @IsOptional()
    defaultParams?: VideoModelDefaultParams;

    @IsString()
    @IsOptional()
    coverImageUrl?: string;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateVideoTemplateDto extends CreateVideoTemplateDto {
    @IsString()
    @Length(1, 120)
    @IsOptional()
    declare title: string;

    @IsString()
    @Length(1, 4000)
    @IsOptional()
    declare prompt: string;
}
