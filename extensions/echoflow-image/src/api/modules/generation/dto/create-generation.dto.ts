import { Transform } from "class-transformer";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from "class-validator";

import { ImageGenerationMode, ImageResponseFormat } from "../../../db/entities/image-generation.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class GenerationSourceImageDto {
    @IsString()
    @Length(1, 2000)
    @IsOptional()
    url?: string;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    fileId?: string;
}

export class CreateGenerationDto {
    @IsString()
    @Length(1, 4000)
    prompt: string;

    @IsString()
    @Length(0, 2000)
    @IsOptional()
    negativePrompt?: string;

    @IsString()
    @Length(1, 2000)
    @IsOptional()
    referenceImageUrl?: string;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    referenceImageFileId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GenerationSourceImageDto)
    @IsOptional()
    sourceImages?: GenerationSourceImageDto[];

    @IsString()
    @Length(1, 2000)
    @IsOptional()
    maskImageUrl?: string;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    maskImageFileId?: string;

    @IsUUID("4")
    modelId: string;

    @IsString()
    @Length(1, 60)
    @IsOptional()
    size?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @Max(4)
    @IsOptional()
    n?: number;

    @IsString()
    @Length(1, 60)
    @IsOptional()
    quality?: string;

    @IsString()
    @Length(1, 60)
    @IsOptional()
    style?: string;

    @IsEnum(ImageResponseFormat)
    @IsOptional()
    responseFormat?: ImageResponseFormat;

    @IsIn(["png", "jpeg", "webp"])
    @IsOptional()
    outputFormat?: string;

    @IsIn(["auto", "transparent", "opaque"])
    @IsOptional()
    background?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @Max(100)
    @IsOptional()
    outputCompression?: number;

    @IsIn(["auto", "high", "low"])
    @IsOptional()
    inputFidelity?: string;

    @IsIn(["auto", "low"])
    @IsOptional()
    moderation?: string;

    @IsString()
    @Length(0, 100)
    @IsOptional()
    seed?: string;

    @IsEnum(ImageGenerationMode)
    @IsOptional()
    mode?: ImageGenerationMode;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    requestKey?: string;
}
