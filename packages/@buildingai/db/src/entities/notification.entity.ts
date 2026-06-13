import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "notification", comment: "用户通知" })
@Index("IDX_notification_user_read", ["userId", "readAt"])
export class Notification extends BaseEntity {
    @Column({ length: 36, comment: "用户ID" })
    @Index("IDX_notification_user_id")
    userId: string;

    @Column({ length: 128, comment: "通知标题" })
    title: string;

    @Column({ type: "text", nullable: true, comment: "通知内容" })
    content?: string | null;

    @Column({ length: 32, default: "system", comment: "通知类型" })
    type: string;

    @Column({ length: 16, default: "info", comment: "通知等级" })
    level: string;

    @Column({ length: 512, nullable: true, comment: "点击跳转地址" })
    linkUrl?: string | null;

    @Column({
        type: "jsonb",
        nullable: true,
        default: () => "'{}'",
        comment: "业务扩展数据",
    })
    data?: Record<string, unknown> | null;

    @Column({ type: "timestamptz", nullable: true, comment: "已读时间" })
    readAt?: Date | null;
}
