import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Permissions } from "@common/decorators";
import { ConsoleController } from "@common/decorators/controller.decorator";
import { Body, Get, Param, Patch, Post, Query } from "@nestjs/common";

import {
    QueryNotificationDeliveryDto,
    TestNotificationSceneDto,
    UpdateNotificationSceneDto,
} from "../../dto/notification.dto";
import { NotificationService } from "../../services/notification.service";

@ConsoleController("notification", "通知中心")
export class NotificationConsoleController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get("scenes")
    @Permissions({
        code: "notification-scenes-list",
        name: "通知场景列表",
        description: "查看通知场景和模板配置",
    })
    async listScenes() {
        return this.notificationService.listScenes();
    }

    @Patch("scenes/:sceneCode")
    @Permissions({
        code: "notification-scenes-update",
        name: "更新通知场景",
        description: "更新通知场景渠道、模板和状态",
    })
    async updateScene(
        @Param("sceneCode") sceneCode: string,
        @Body() dto: UpdateNotificationSceneDto,
    ) {
        return this.notificationService.updateScene(sceneCode, dto);
    }

    @Post("scenes/:sceneCode/test")
    @Permissions({
        code: "notification-scenes-test",
        name: "测试通知场景",
        description: "按指定场景向用户发送测试通知",
    })
    async testScene(
        @Param("sceneCode") sceneCode: string,
        @Body() dto: TestNotificationSceneDto,
        @Playground() user: UserPlayground,
    ) {
        return this.notificationService.testScene(sceneCode, dto, user.id);
    }

    @Get("channels")
    @Permissions({
        code: "notification-channels-list",
        name: "通知渠道状态",
        description: "查看站内、浏览器、公众号和短信渠道状态",
    })
    async getChannelStatus() {
        return this.notificationService.getChannelStatus();
    }

    @Get("deliveries")
    @Permissions({
        code: "notification-deliveries-list",
        name: "通知投递日志",
        description: "查看通知渠道投递结果和失败原因",
    })
    async listDeliveries(@Query() query: QueryNotificationDeliveryDto) {
        return this.notificationService.listDeliveries(query);
    }
}
