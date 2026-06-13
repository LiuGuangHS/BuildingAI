import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class QueryNotificationDto extends PaginationDto {
    @IsOptional()
    @IsIn(["all", "read", "unread"])
    readStatus?: "all" | "read" | "unread" = "all";

    @IsOptional()
    @IsString()
    @MaxLength(32)
    type?: string;
}

export class CreateNotificationDto {
    @IsString()
    @MaxLength(36)
    userId: string;

    @IsString()
    @MaxLength(128)
    title: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    type?: string;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    level?: string;

    @IsOptional()
    @IsString()
    @MaxLength(512)
    linkUrl?: string;

    @IsOptional()
    data?: Record<string, unknown>;
}

export class SubscribePushDto {
    @IsString()
    endpoint: string;

    @IsOptional()
    @Transform(({ value }) => (value ? new Date(value) : null))
    expirationTime?: Date | null;

    keys: {
        p256dh: string;
        auth: string;
    };
}

export class UnsubscribePushDto {
    @IsOptional()
    @IsString()
    endpoint?: string;
}
