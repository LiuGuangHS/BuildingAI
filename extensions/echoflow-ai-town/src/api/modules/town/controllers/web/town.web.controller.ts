import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateTownSaveDto, QueryTownSaveDto, TownActionDto, TownChatDto } from "../../dto";
import { TownService } from "../../services/town.service";

@ExtensionWebController("ai-town")
export class TownWebController {
    private readonly townService: TownService;

    constructor(townService: TownService) {
        this.townService = townService;
    }

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
    runAction(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: TownActionDto) {
        return this.townService.runAction(user.id, id, dto);
    }

    @Post("saves/:id/chat")
    chat(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: TownChatDto) {
        return this.townService.chat(user.id, id, dto);
    }

    @Get("saves/:id/events")
    getEvents(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.townService.getEvents(user.id, id);
    }

    @Delete("saves/:id")
    async deleteSave(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        await this.townService.deleteSave(user.id, id);
        return { success: true };
    }
}
