import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Length } from "class-validator";

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

export class BatchVideoIdsDto {
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID(undefined, { each: true })
    ids: string[];
}
