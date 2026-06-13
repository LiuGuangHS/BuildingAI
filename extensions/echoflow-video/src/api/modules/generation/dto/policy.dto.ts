import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";

import { VideoPolicyScope } from "../../../db/entities/video-policy-config.entity";

export class UpsertVideoPolicyDto {
    @IsEnum(VideoPolicyScope)
    @IsOptional()
    scope?: VideoPolicyScope;

    @IsUUID("4")
    @IsOptional()
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
    maxMediaItemsPerRequest?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @IsOptional()
    maxReferenceImages?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxVideoSizeMb?: number;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @IsOptional()
    maxImageSizeMb?: number;

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
    allowPublicMediaUrl?: boolean;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}
