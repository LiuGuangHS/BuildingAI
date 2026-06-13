import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from "class-validator";

import type { ImageModelDefaultParams } from "../../../db/entities/image-model-config.entity";

export class QueryTemplateDto extends PaginationDto {
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
}

export class CreateTemplateDto {
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

    @IsString()
    @Length(0, 2000)
    @IsOptional()
    negativePrompt?: string;

    @IsObject()
    @IsOptional()
    defaultParams?: ImageModelDefaultParams;

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

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsString()
    @Length(1, 120)
    @IsOptional()
    title: string;

    @IsString()
    @Length(1, 4000)
    @IsOptional()
    prompt: string;
}
