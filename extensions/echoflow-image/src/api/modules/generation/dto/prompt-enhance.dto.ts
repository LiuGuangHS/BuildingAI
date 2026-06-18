import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, Length } from "class-validator";

import { emptyStringToUndefined } from "../../common/dto-transforms";

export class PromptEnhanceDto {
    @IsString()
    @Length(1, 4000)
    prompt: string;

    @Transform(emptyStringToUndefined)
    @IsOptional()
    @IsUUID("4")
    modelId?: string;

    @IsString()
    @Length(0, 60)
    @IsOptional()
    style?: string;
}
