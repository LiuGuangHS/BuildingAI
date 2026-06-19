import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "notification", comment: "用户通知" })
@Index("IDX_notification_user_read", ["userId", "readAt"])
@Index("UQ_notification_user_dedupe_key", ["userId", "dedupeKey"], {
    unique: true,
    where: "\"dedupe_key\" IS NOT NULL",
})
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

    @Column({ length: 64, nullable: true, comment: "来源插件ID" })
    @Index("IDX_notification_extension")
    extensionId?: string | null;

    @Column({ length: 96, nullable: true, comment: "通知场景编码" })
    @Index("IDX_notification_scene_code")
    sceneCode?: string | null;

    @Column({ length: 64, nullable: true, comment: "业务来源类型" })
    sourceType?: string | null;

    @Column({ length: 96, nullable: true, comment: "业务来源ID" })
    sourceId?: string | null;

    @Column({ length: 160, nullable: true, comment: "业务幂等键" })
    @Index("IDX_notification_dedupe_key")
    dedupeKey?: string | null;

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
