import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform, Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from "class-validator";

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
    @MaxLength(64)
    extensionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(96)
    sceneCode?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    sourceType?: string;

    @IsOptional()
    @IsString()
    @MaxLength(96)
    sourceId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(160)
    dedupeKey?: string;

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

export class CreateBusinessNotificationDto {
    @IsString()
    @MaxLength(36)
    userId: string;

    @IsOptional()
    @IsString()
    @MaxLength(128)
    title?: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    type?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    extensionId?: string;

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

    @IsOptional()
    @IsString()
    @MaxLength(96)
    sceneCode?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    sourceType?: string;

    @IsOptional()
    @IsString()
    @MaxLength(96)
    sourceId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(160)
    dedupeKey?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    channels?: string[];
}

export class QueryNotificationDeliveryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    extensionId?: string;

    @IsOptional()
    @IsString()
    sceneCode?: string;

    @IsOptional()
    @IsString()
    channel?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    userId?: string;
}

export class UpdateNotificationSceneDto {
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    level?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    channels?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(128)
    titleTemplate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    contentTemplate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(512)
    linkUrlTemplate?: string;

    @IsOptional()
    @IsObject()
    wechatTemplate?: Record<string, unknown>;

    @IsOptional()
    @IsBoolean()
    userConfigurable?: boolean;
}

export class UpdateNotificationPreferencesDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(96, { each: true })
    disabledScenes?: string[];
}

export class TestNotificationSceneDto {
    @IsOptional()
    @IsString()
    @MaxLength(36)
    userId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    channels?: string[];
}

export class PushSubscriptionKeysDto {
    @IsString()
    @MaxLength(512)
    p256dh: string;

    @IsString()
    @MaxLength(512)
    auth: string;
}

export class SubscribePushDto {
    @IsString()
    @MaxLength(2048)
    endpoint: string;

    @IsOptional()
    @Transform(({ value }) => (value ? new Date(value) : null))
    expirationTime?: Date | null;

    @IsObject()
    @ValidateNested()
    @Type(() => PushSubscriptionKeysDto)
    keys: PushSubscriptionKeysDto;
}

export class UnsubscribePushDto {
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    endpoint?: string;
}
