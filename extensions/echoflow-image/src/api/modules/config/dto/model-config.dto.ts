import { PaginationDto } from "@buildingai/dto";
import { Transform } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Length,
} from "class-validator";

import {
    ImageApiMode,
    ImageRequestPolicy,
    ImageResponsesTransport,
    type ImageModelAllowedParams,
    type ImageModelCapabilities,
    type ImageModelDefaultParams,
} from "../../../db/entities/image-model-config.entity";
import { emptyStringToUndefined } from "../../common/dto-transforms";

export class QueryModelConfigDto extends PaginationDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @Transform(({ value }) => (value === undefined ? value : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;
}

export class QueryAvailableAiModelDto {
    @IsString()
    @IsOptional()
    keyword?: string;

    @Transform(({ value }) => (value === undefined ? true : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    imageOnly?: boolean;

    @Transform(({ value }) => (value === undefined ? false : value === "true" || value === true))
    @IsBoolean()
    @IsOptional()
    activeOnly?: boolean;
}

export class CreateModelConfigDto {
    @IsUUID("4")
    aiModelId: string;

    @IsString()
    @Length(1, 120)
    displayName: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsEnum(ImageApiMode)
    @IsOptional()
    apiMode?: ImageApiMode;

    @IsEnum(ImageResponsesTransport)
    @IsOptional()
    responsesTransport?: ImageResponsesTransport;

    @IsEnum(ImageRequestPolicy)
    @IsOptional()
    requestPolicy?: ImageRequestPolicy;

    @IsObject()
    @IsOptional()
    capabilities?: ImageModelCapabilities;

    @IsObject()
    @IsOptional()
    defaultParams?: ImageModelDefaultParams;

    @IsObject()
    @IsOptional()
    allowedParams?: ImageModelAllowedParams;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateModelConfigDto extends CreateModelConfigDto {
    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    aiModelId: string;

    @IsString()
    @Length(1, 120)
    @IsOptional()
    displayName: string;
}
