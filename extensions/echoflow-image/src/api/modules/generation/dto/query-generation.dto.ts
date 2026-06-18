import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

import { ImageGenerationMode, ImageGenerationStatus } from "../../../db/entities/image-generation.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class QueryGenerationDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsEnum(ImageGenerationStatus)
    @IsOptional()
    status?: ImageGenerationStatus;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    modelId?: string;

    @IsEnum(ImageGenerationMode)
    @IsOptional()
    mode?: ImageGenerationMode;
}
