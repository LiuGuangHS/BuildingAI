import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "push_subscription", comment: "浏览器推送订阅" })
@Index("UQ_push_subscription_endpoint", ["endpoint"], { unique: true })
@Index("IDX_push_subscription_user_enabled", ["userId", "isEnabled"])
export class PushSubscription extends BaseEntity {
    @Column({ length: 36, comment: "用户ID" })
    userId: string;

    @Column({ type: "text", comment: "推送端点" })
    endpoint: string;

    @Column({ type: "text", comment: "p256dh 公钥" })
    p256dh: string;

    @Column({ type: "text", comment: "auth 密钥" })
    auth: string;

    @Column({ type: "text", nullable: true, comment: "浏览器 UA" })
    userAgent?: string | null;

    @Column({ type: "timestamptz", nullable: true, comment: "订阅过期时间" })
    expiresAt?: Date | null;

    @Column({ type: "boolean", default: true, comment: "是否启用" })
    isEnabled: boolean;

    @Column({ type: "integer", default: 0, comment: "失败次数" })
    failureCount: number;

    @Column({ type: "timestamptz", nullable: true, comment: "最后推送时间" })
    lastUsedAt?: Date | null;

    @Column({ type: "timestamptz", nullable: true, comment: "最后失败时间" })
    failedAt?: Date | null;
}
