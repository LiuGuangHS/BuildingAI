import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Notification, PushSubscription } from "@buildingai/db/entities";
import { DictModule } from "@buildingai/dict";

import { SmsConfigWebController } from "./controllers/web/sms-config.controller";
import { NotificationWebController } from "./controllers/web/notification.controller";
import { NotificationService } from "./services/notification.service";
import { WebPushService } from "./services/web-push.service";

@Module({
    controllers: [SmsConfigWebController, NotificationWebController],
    imports: [TypeOrmModule.forFeature([Notification, PushSubscription]), DictModule],
    providers: [NotificationService, WebPushService],
    exports: [NotificationService],
})
export class NotificationModule {}
