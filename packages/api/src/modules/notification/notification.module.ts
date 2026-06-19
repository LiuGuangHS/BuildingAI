import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { EXTENSION_NOTIFICATION_PORT } from "@buildingai/core/modules";
import {
    Notification,
    NotificationDelivery,
    NotificationScene,
    PushSubscription,
    User,
} from "@buildingai/db/entities";
import { DictModule } from "@buildingai/dict";
import { WechatModule } from "@common/modules/wechat/wechat.module";

import { NotificationConsoleController } from "./controllers/console/notification-console.controller";
import { SmsConfigWebController } from "./controllers/web/sms-config.controller";
import { NotificationWebController } from "./controllers/web/notification.controller";
import { NotificationService } from "./services/notification.service";
import { WebPushService } from "./services/web-push.service";

@Global()
@Module({
    controllers: [SmsConfigWebController, NotificationWebController, NotificationConsoleController],
    imports: [
        TypeOrmModule.forFeature([
            Notification,
            NotificationDelivery,
            NotificationScene,
            PushSubscription,
            User,
        ]),
        DictModule,
        WechatModule,
    ],
    providers: [
        NotificationService,
        WebPushService,
        {
            provide: EXTENSION_NOTIFICATION_PORT,
            useExisting: NotificationService,
        },
    ],
    exports: [NotificationService, EXTENSION_NOTIFICATION_PORT],
})
export class NotificationModule {}
