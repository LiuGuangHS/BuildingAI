import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class CreateTownSaveDto {
    @IsString()
    @MaxLength(120)
    @IsOptional()
    name?: string;
}

export class QueryTownSaveDto {
    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    pageSize?: number;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    keyword?: string;
}

export class TownActionDto {
    @IsIn(["operate", "visit", "decorate", "explore", "rest", "advice", "upgrade"])
    action!: "operate" | "visit" | "decorate" | "explore" | "rest" | "advice" | "upgrade";

    @IsString()
    @IsOptional()
    @MaxLength(80)
    choiceId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    buildingId?: string;
}

export class TownChatDto {
    @IsString()
    @IsUUID("4")
    characterId!: string;

    @IsString()
    @MaxLength(400)
    message!: string;
}

export class UpdateTownAiConfigDto {
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsString()
    @IsOptional()
    @ValidateIf((_object, value) => value !== null && value !== "")
    @IsUUID("4")
    defaultModelId?: string | null;

    @IsNumber()
    @Min(0)
    @Max(2)
    @IsOptional()
    @Type(() => Number)
    temperature?: number;

    @IsInt()
    @Min(200)
    @Max(4000)
    @IsOptional()
    @Type(() => Number)
    maxTokens?: number;

    @IsBoolean()
    @IsOptional()
    fallbackToRules?: boolean;

    @IsInt()
    @Min(0)
    @Max(10000)
    @IsOptional()
    @Type(() => Number)
    dailyLimitPerUser?: number;

    @IsInt()
    @Min(0)
    @Max(100000)
    @IsOptional()
    @Type(() => Number)
    adviceCostPower?: number;

    @IsInt()
    @Min(0)
    @Max(100000)
    @IsOptional()
    @Type(() => Number)
    chatCostPower?: number;

    @IsInt()
    @Min(0)
    @Max(100000)
    @IsOptional()
    @Type(() => Number)
    eventCostPower?: number;
}
