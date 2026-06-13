import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";

import {
    QueryNotificationDto,
    SubscribePushDto,
    UnsubscribePushDto,
} from "../../dto/notification.dto";
import { NotificationService } from "../../services/notification.service";
import { WebPushService } from "../../services/web-push.service";

@WebController("notifications")
export class NotificationWebController {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly webPushService: WebPushService,
    ) {}

    @Get()
    async list(@Query() query: QueryNotificationDto, @Playground() user: UserPlayground) {
        return this.notificationService.list(user.id, query);
    }

    @Get("unread-count")
    async unreadCount(@Playground() user: UserPlayground) {
        return this.notificationService.unreadCount(user.id);
    }

    @Patch("read-all")
    async markAllRead(@Playground() user: UserPlayground) {
        return this.notificationService.markAllRead(user.id);
    }

    @Patch(":id/read")
    async markRead(@Param("id") id: string, @Playground() user: UserPlayground) {
        return this.notificationService.markRead(user.id, id);
    }

    @Post("test")
    async createTest(@Playground() user: UserPlayground) {
        return this.notificationService.createTestNotification(user.id);
    }

    @Get("push/public-key")
    async getPushPublicKey() {
        return this.webPushService.getPublicKey();
    }

    @Get("push/status")
    async getPushStatus(@Playground() user: UserPlayground) {
        return this.webPushService.getStatus(user.id);
    }

    @Post("push/subscribe")
    async subscribePush(
        @Body() dto: SubscribePushDto,
        @Headers("user-agent") userAgent: string | undefined,
        @Playground() user: UserPlayground,
    ) {
        return this.webPushService.subscribe(user.id, dto, userAgent);
    }

    @Post("push/unsubscribe")
    async unsubscribePush(@Body() dto: UnsubscribePushDto, @Playground() user: UserPlayground) {
        return this.webPushService.unsubscribe(user.id, dto);
    }
}
