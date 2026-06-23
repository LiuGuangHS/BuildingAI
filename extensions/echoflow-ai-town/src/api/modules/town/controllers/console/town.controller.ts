import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { QueryTownSaveDto, UpdateTownAiConfigDto } from "../../dto";
import { TownAiService } from "../../services/town-ai.service";
import { TownService } from "../../services/town.service";

@ExtensionConsoleController("ai-town", "AI乐园小镇管理")
export class TownConsoleController {
    private readonly townService: TownService;
    private readonly townAiService: TownAiService;

    constructor(townService: TownService, townAiService: TownAiService) {
        this.townService = townService;
        this.townAiService = townAiService;
    }

    @Get("saves")
    getSaves(@Query() query: QueryTownSaveDto) {
        return this.townService.getAllSaves(query);
    }

    @Get("saves/:id")
    getSave(@Param("id", UUIDValidationPipe) id: string) {
        return this.townService.getSaveDetailByAdmin(id);
    }

    @Get("statistics")
    getStatistics() {
        return this.townService.getStatistics();
    }

    @Get("content-pack")
    getContentPack() {
        return this.townService.getContentPackOverview();
    }

    @Delete("saves/:id")
    async deleteSave(@Param("id", UUIDValidationPipe) id: string) {
        await this.townService.deleteSaveByAdmin(id);
        return { success: true };
    }

    @Get("ai-config")
    getAiConfig() {
        return this.townAiService.getConfig();
    }

    @Put("ai-config")
    updateAiConfig(@Body() dto: UpdateTownAiConfigDto) {
        return this.townAiService.updateConfig(dto);
    }

    @Get("ai-models")
    getAiModels() {
        return this.townAiService.listAvailableModels();
    }

    @Get("ai-logs")
    async getAiLogs(@Query() query: { type?: "advice" | "chat" | "event" | "structured_event" | "test"; success?: string; fallbackUsed?: string; saveId?: string }) {
        const filters = {
            type: query.type,
            success: query.success === undefined ? undefined : query.success === "true",
            fallbackUsed: query.fallbackUsed === undefined ? undefined : query.fallbackUsed === "true",
            saveId: query.saveId,
        };
        const [stats, logs] = await Promise.all([this.townAiService.getLogStats(filters), this.townAiService.getRecentLogs(30, filters)]);
        return { stats, logs };
    }

    @Post("ai-config/test")
    async testAi(@Body("prompt") prompt?: string) {
        const result = await this.townAiService.testGenerate(prompt ?? "");
        return { text: result.text };
    }
}
