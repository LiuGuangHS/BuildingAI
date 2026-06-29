import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUrl, Length } from "class-validator";

import type { ImageModelDefaultParams } from "../../../db/entities/image-model-config.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class QueryTemplateDto extends PaginationDto {
    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 120)
    @IsOptional()
    keyword?: string;

    @Transform(emptyStringToUndefined)
    @IsString()
    @Length(1, 80)
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

    @Transform(emptyStringToUndefined)
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

    @Transform(emptyStringToUndefined)
    @IsString()
    @IsUrl({ protocols: ["http", "https"], require_protocol: true })
    @Length(1, 1000)
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
    declare title: string;

    @IsString()
    @Length(1, 4000)
    @IsOptional()
    declare prompt: string;
}
