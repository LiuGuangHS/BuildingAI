import { PaginationDto } from "@buildingai/dto";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

import { ImageGenerationMode, ImageGenerationStatus } from "../../../db/entities/image-generation.entity";

export class QueryGenerationDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsEnum(ImageGenerationStatus)
    @IsOptional()
    status?: ImageGenerationStatus;

    @IsUUID("4")
    @IsOptional()
    modelId?: string;

    @IsEnum(ImageGenerationMode)
    @IsOptional()
    mode?: ImageGenerationMode;
}
