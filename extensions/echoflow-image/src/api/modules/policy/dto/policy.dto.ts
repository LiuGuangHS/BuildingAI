import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";

import { ImagePolicyScope } from "../../../db/entities/image-policy-config.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class UpsertPolicyDto {
    @IsEnum(ImagePolicyScope)
    @IsOptional()
    scope?: ImagePolicyScope;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    modelConfigId?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxPromptLength?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @IsOptional()
    maxNegativePromptLength?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxImagesPerRequest?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @IsOptional()
    maxReferenceImages?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxReferenceImageSizeMb?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxConcurrentJobsPerUser?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    dailyJobsPerUser?: number;

    @IsBoolean()
    @IsOptional()
    allowPublicUrlReference?: boolean;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}
