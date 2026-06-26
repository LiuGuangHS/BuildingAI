import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { ExtensionRateLimitService, type ExtensionRateLimitWindow } from "@buildingai/extension-sdk";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateTownSaveDto, QueryTownSaveDto, TownActionDto, TownChatDto } from "../../dto";
import { TownService } from "../../services/town.service";

const TOWN_RATE_LIMIT_WINDOWS: ExtensionRateLimitWindow[] = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
];

@ExtensionWebController("ai-town")
export class TownWebController extends BaseController {
    constructor(
        private readonly townService: TownService,
        private readonly rateLimitService: ExtensionRateLimitService,
    ) {}

    @Post("saves")
    createSave(@Playground() user: UserPlayground, @Body() dto: CreateTownSaveDto) {
        return this.townService.createSave(user.id, dto);
    }

    @Get("saves")
    getSaves(@Playground() user: UserPlayground, @Query() query: QueryTownSaveDto) {
        return this.townService.getUserSaves(user.id, query);
    }

    @Get("saves/:id")
    getSave(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.townService.getSaveDetail(user.id, id);
    }

    @Post("saves/:id/action")
    async runAction(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: TownActionDto) {
        await this.assertRateLimit("town-action", user.id);
        return this.townService.runAction(user.id, id, dto);
    }

    @Post("saves/:id/chat")
    async chat(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: TownChatDto) {
        await this.assertRateLimit("town-chat", user.id);
        return this.townService.chat(user.id, id, dto);
    }

    @Get("saves/:id/events")
    getEvents(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Query("take") take?: string) {
        return this.townService.getEvents(user.id, id, take ? parseInt(take as string, 10) : undefined);
    }

    @Delete("saves/:id")
    async deleteSave(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        await this.townService.deleteSave(user.id, id);
        return { success: true };
    }

    private async assertRateLimit(action: "town-action" | "town-chat", userId: string) {
        await this.rateLimitService.assertAllowed({
            namespace: "echoflow-ai-town",
            action,
            subject: userId,
            windows: TOWN_RATE_LIMIT_WINDOWS,
            message: "请求过于频繁，请稍后重试",
        });
    }
}
