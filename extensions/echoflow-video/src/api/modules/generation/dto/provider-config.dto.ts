import { Transform, Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    ValidateNested,
} from "class-validator";

export class PromptTemplateDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 80)
    label: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 1000)
    prompt: string;
}

export class UpdateProviderConfigDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsUUID()
    @IsOptional()
    webhookSecretId?: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 120)
    @IsOptional()
    webhookSecretName?: string;

    @IsBoolean()
    @IsOptional()
    clearWebhookSecret?: boolean;

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

    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => PromptTemplateDto)
    @IsOptional()
    templates?: PromptTemplateDto[];
}
