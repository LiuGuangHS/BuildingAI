import { Transform, Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Length,
    Max,
    Min,
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
    @IsString()
    @Length(1, 500)
    @IsOptional()
    apiKey?: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
    @Length(1, 500)
    @IsOptional()
    baseUrl?: string;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(3000)
    @Max(300000)
    @IsOptional()
    requestTimeoutMs?: number;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(3000)
    @Max(60000)
    @IsOptional()
    testTimeoutMs?: number;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(0)
    @Max(5)
    @IsOptional()
    maxRetries?: number;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(100)
    @Max(10000)
    @IsOptional()
    retryDelayMs?: number;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(8, 500)
    @IsOptional()
    webhookSecret?: string;

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

    @IsBoolean()
    @IsOptional()
    promptOptimizerBillingEnabled?: boolean;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(1)
    @Max(100000)
    @IsOptional()
    promptOptimizerBillingPower?: number;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(1)
    @Max(1000000)
    @IsOptional()
    promptOptimizerBillingTokens?: number;

    @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
    @IsInt()
    @Min(50)
    @Max(20000)
    @IsOptional()
    promptOptimizerEstimatedTokens?: number;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => PromptTemplateDto)
    @IsOptional()
    templates?: PromptTemplateDto[];
}
