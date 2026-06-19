import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "notification_delivery", comment: "通知渠道投递记录" })
@Index("IDX_notification_delivery_notification", ["notificationId"])
@Index("IDX_notification_delivery_channel_status", ["channel", "status"])
export class NotificationDelivery extends BaseEntity {
    @Column({ length: 36, comment: "站内通知ID" })
    notificationId: string;

    @Column({ length: 36, comment: "用户ID" })
    userId: string;

    @Column({ length: 96, comment: "场景编码" })
    sceneCode: string;

    @Column({ length: 64, nullable: true, comment: "来源插件ID" })
    @Index("IDX_notification_delivery_extension")
    extensionId?: string | null;

    @Column({ length: 64, nullable: true, comment: "业务来源类型" })
    sourceType?: string | null;

    @Column({ length: 96, nullable: true, comment: "业务来源ID" })
    sourceId?: string | null;

    @Column({ length: 32, comment: "渠道" })
    channel: string;

    @Column({ length: 16, default: "pending", comment: "投递状态" })
    status: string;

    @Column({ type: "integer", default: 0, comment: "尝试次数" })
    attempts: number;

    @Column({ length: 128, nullable: true, comment: "上游消息ID" })
    providerMessageId?: string | null;

    @Column({ length: 64, nullable: true, comment: "错误码" })
    errorCode?: string | null;

    @Column({ type: "text", nullable: true, comment: "错误信息" })
    errorMessage?: string | null;

    @Column({ type: "jsonb", nullable: true, default: () => "'{}'", comment: "投递载荷摘要" })
    payload?: Record<string, unknown> | null;

    @Column({ type: "timestamptz", nullable: true, comment: "发送时间" })
    sentAt?: Date | null;
}
