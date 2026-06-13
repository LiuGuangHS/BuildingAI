import { IsOptional, IsString, IsUUID, Length } from "class-validator";

export class PromptEnhanceDto {
    @IsString()
    @Length(1, 4000)
    prompt: string;

    @IsUUID("4")
    @IsOptional()
    modelId?: string;

    @IsString()
    @Length(0, 60)
    @IsOptional()
    style?: string;
}
