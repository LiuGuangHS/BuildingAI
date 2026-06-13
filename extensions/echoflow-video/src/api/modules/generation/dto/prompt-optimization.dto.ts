import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";

export const PromptOptimizationStyles = [
    "cinematic",
    "commercial",
    "realistic",
    "anime",
    "minimal",
] as const;

export type PromptOptimizationStyle = (typeof PromptOptimizationStyles)[number];

export class OptimizePromptDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 2000)
    prompt: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 120)
    @IsOptional()
    model?: string;

    @IsIn(PromptOptimizationStyles)
    @IsOptional()
    style?: PromptOptimizationStyle;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
    @IsUUID()
    @IsOptional()
    modelId?: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
    @IsString()
    @Length(1, 100)
    @IsOptional()
    requestKey?: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 120)
    @IsOptional()
    ratio?: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @Length(1, 120)
    @IsOptional()
    resolution?: string;
}
