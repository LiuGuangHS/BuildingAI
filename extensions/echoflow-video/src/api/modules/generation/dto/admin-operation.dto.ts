import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";

import { VideoGenerationStatus } from "../../../db/entities/video-generation.entity";

export class UpdateVideoAdminRemarkDto {
    @IsString()
    @Length(0, 2000)
    adminRemark: string;
}

export class MarkVideoStatusDto {
    @IsEnum(VideoGenerationStatus)
    status: VideoGenerationStatus;

    @IsString()
    @Length(1, 2000)
    @IsOptional()
    message?: string;

    @IsString()
    @Length(1, 50)
    @IsOptional()
    failureCategory?: string;
}

export class BatchVideoStatusDto {
    @IsIn([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING])
    @IsOptional()
    status?: "pending" | "processing";

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number;
}

export class BatchVideoIdsDto {
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID(undefined, { each: true })
    ids: string[];
}
