import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "notification_scene", comment: "通知场景配置" })
@Index("UQ_notification_scene_code", ["sceneCode"], { unique: true })
export class NotificationScene extends BaseEntity {
    @Column({ length: 96, comment: "场景编码" })
    sceneCode: string;

    @Column({ length: 64, nullable: true, comment: "来源插件ID" })
    @Index("IDX_notification_scene_extension")
    extensionId?: string | null;

    @Column({ length: 64, comment: "场景名称" })
    name: string;

    @Column({ type: "text", nullable: true, comment: "场景说明" })
    description?: string | null;

    @Column({ type: "boolean", default: true, comment: "是否启用" })
    isEnabled: boolean;

    @Column({ length: 16, default: "info", comment: "默认等级" })
    level: string;

    @Column({ type: "jsonb", default: () => "'[\"in_app\",\"web_push\"]'", comment: "默认渠道" })
    channels: string[];

    @Column({ length: 128, comment: "站内通知标题模板" })
    titleTemplate: string;

    @Column({ type: "text", nullable: true, comment: "站内通知内容模板" })
    contentTemplate?: string | null;

    @Column({ length: 512, nullable: true, comment: "跳转链接模板" })
    linkUrlTemplate?: string | null;

    @Column({ type: "jsonb", nullable: true, default: () => "'{}'", comment: "微信公众号模板配置" })
    wechatTemplate?: Record<string, unknown> | null;

    @Column({ type: "boolean", default: true, comment: "是否允许用户关闭" })
    userConfigurable: boolean;
}
