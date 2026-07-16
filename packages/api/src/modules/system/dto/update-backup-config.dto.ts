import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateBackupConfigDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    retentionDays?: number;
}
