import { Transform } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsUUID,
} from "class-validator";

export class UpdateProviderConfigDto {
    @IsBoolean()
    @IsOptional()
    promptOptimizerEnabled?: boolean;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
    @IsUUID()
    @IsOptional()
    promptOptimizerModelId?: string;

    @IsBoolean()
    @IsOptional()
    clearPromptOptimizerModelId?: boolean;

    @IsArray()
    @ArrayMaxSize(20)
    @IsUUID(undefined, { each: true })
    @IsOptional()
    promptOptimizerAllowedModelIds?: string[];
}
