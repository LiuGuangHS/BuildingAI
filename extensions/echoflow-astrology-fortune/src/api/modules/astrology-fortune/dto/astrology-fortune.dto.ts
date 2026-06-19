import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

import { AstrologyReportStatus, AstrologyReportType } from "../../../db/entities";

export class CreateAstrologyProfileDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    gender?: string;

    @IsDateString()
    birthDate: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    birthTime?: string;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    birthPlace?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    zodiacSign?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    moonSign?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    risingSign?: string;
}

export class UpdateAstrologyProfileDto {
    @IsString()
    @IsOptional()
    @MaxLength(120)
    name: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    gender?: string;

    @IsDateString()
    @IsOptional()
    birthDate: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    birthTime?: string;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    birthPlace?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    zodiacSign?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    moonSign?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    risingSign?: string;
}

export class GenerateAstrologyReportDto {
    @IsString()
    @IsIn(Object.values(AstrologyReportType))
    reportType: AstrologyReportType;

    @IsOptional()
    @IsUUID("4")
    profileId?: string;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => CreateAstrologyProfileDto)
    profile?: Partial<CreateAstrologyProfileDto>;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    question?: string;

    @IsObject()
    @IsOptional()
    targetProfile?: Record<string, unknown>;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    focusArea?: string;

    @IsString()
    @IsOptional()
    @MaxLength(300)
    currentState?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    language?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    sourceReportId?: string;
}

export class QueryAstrologyProfileDto {
    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    pageSize?: number;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    keyword?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    userId?: string;
}

export class QueryAstrologyReportDto extends QueryAstrologyProfileDto {
    @IsString()
    @IsOptional()
    @IsIn(Object.values(AstrologyReportType))
    reportType?: AstrologyReportType;

    @IsString()
    @IsOptional()
    @IsIn(Object.values(AstrologyReportStatus))
    status?: AstrologyReportStatus;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    profileId?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    modelId?: string;

    @IsString()
    @IsOptional()
    @IsUUID("4")
    providerId?: string;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    isFavorite?: boolean;
}

export class UpdateFavoriteDto {
    @IsBoolean()
    @Transform(({ value }) => value === true || value === "true")
    isFavorite: boolean;
}

export class UpdateReportFeedbackDto {
    @IsString()
    @IsIn(["useful", "too_generic", "inaccurate", "too_long"])
    rating: "useful" | "too_generic" | "inaccurate" | "too_long";

    @IsString()
    @IsOptional()
    @MaxLength(300)
    note?: string;
}

export class UpdateAstrologyFortuneSettingDto {
    @IsString()
    @IsOptional()
    @IsUUID("4")
    defaultModelId?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    dailyPrice?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    reportPrice?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    compatibilityPrice?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    decisionPrice?: number;
}
