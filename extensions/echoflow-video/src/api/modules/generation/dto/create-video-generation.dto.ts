import { Transform, Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Max,
    Min,
    ValidateNested,
} from "class-validator";

class VideoMediaItemDto {
    @IsIn(["first_frame", "reference_image", "video"])
    type: "first_frame" | "reference_image" | "video";

    @IsString()
    url: string;

    @IsString()
    @IsOptional()
    fileId?: string;

    @IsString()
    @IsOptional()
    mimeType?: string;

    @IsString()
    @Length(1, 255)
    @IsOptional()
    fileName?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(0)
    @Max(1024 * 1024 * 1024)
    @IsOptional()
    size?: number;
}

export class CreateVideoGenerationDto {
    @IsString()
    @Length(1, 4000)
    prompt: string;

    @IsString()
    @Length(1, 4000)
    @IsOptional()
    originalPrompt?: string;

    @IsIn(["ai", "local"])
    @IsOptional()
    promptOptimizationSource?: "ai" | "local";

    @IsString()
    @Length(1, 30)
    @IsOptional()
    promptOptimizationStyle?: string;

    @IsUUID("4")
    @IsOptional()
    promptOptimizerModelId?: string;

    @IsUUID("4")
    modelConfigId: string;

    @IsString()
    @Length(1, 100)
    @IsOptional()
    requestKey?: string;

    @IsArray()
    @ArrayMaxSize(5)
    @ValidateNested({ each: true })
    @Type(() => VideoMediaItemDto)
    @IsOptional()
    media?: VideoMediaItemDto[];

    @IsString()
    @Length(1, 30)
    @IsOptional()
    resolution?: string;

    @Transform(({ value }) => (value == null ? value : Number(value)))
    @IsInt()
    @Min(1)
    @Max(30)
    @IsOptional()
    duration?: number;

    @IsString()
    @Length(1, 30)
    @IsOptional()
    ratio?: string;

    @Transform(({ value }) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
    })
    @IsBoolean()
    @IsOptional()
    watermark?: boolean;

}
