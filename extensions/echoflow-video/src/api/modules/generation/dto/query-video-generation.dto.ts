import { PaginationDto } from "@buildingai/dto";
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, Length } from "class-validator";

import {
    VideoGenerationBillingStatus,
    VideoGenerationStatus,
} from "../../../db/entities/video-generation.entity";

export class QueryVideoGenerationDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsEnum(VideoGenerationStatus)
    @IsOptional()
    status?: VideoGenerationStatus;

    @IsString()
    @Length(1, 100)
    @IsOptional()
    model?: string;

    @IsEnum(VideoGenerationBillingStatus)
    @IsOptional()
    billingStatus?: VideoGenerationBillingStatus;

    @IsString()
    @Length(1, 50)
    @IsOptional()
    failureCategory?: string;

    @IsDateString()
    @IsOptional()
    dateFrom?: string;

    @IsDateString()
    @IsOptional()
    dateTo?: string;

    @IsIn(["createdAt", "updatedAt", "completedAt", "billingAmount"])
    @IsOptional()
    sortBy?: "createdAt" | "updatedAt" | "completedAt" | "billingAmount";

    @IsIn(["ASC", "DESC", "asc", "desc"])
    @IsOptional()
    sortOrder?: "ASC" | "DESC" | "asc" | "desc";
}
