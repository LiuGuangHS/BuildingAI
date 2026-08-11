import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { QueryAstrologyProfileDto, QueryAstrologyReportDto, UpdateAstrologyFortuneSettingDto } from "../../dto";
import { AstrologyFortuneService } from "../../services";
import { toConsoleAstrologyProfile, toConsoleAstrologyReport } from "../../services/astrology-public-serializers";

@ExtensionConsoleController("astrology-fortune", "AI星盘运势管理")
export class AstrologyFortuneConsoleController extends BaseController {
    constructor(private readonly astrologyFortuneService: AstrologyFortuneService) {
        super();
    }

    @Get("profiles")
    async profiles(@Query() query: QueryAstrologyProfileDto) {
        const page = await this.astrologyFortuneService.getAllProfiles(query);
        return {
            ...page,
            items: page.items.map(toConsoleAstrologyProfile),
        };
    }

    @Get("settings")
    settings() {
        return this.astrologyFortuneService.getSetting();
    }

    @Get("ai-models")
    aiModels() {
        return this.astrologyFortuneService.listAvailableLlmModels();
    }

    @Patch("settings")
    updateSettings(@Body() dto: UpdateAstrologyFortuneSettingDto) {
        return this.astrologyFortuneService.updateSetting(dto);
    }

    @Get("reports")
    async reports(@Query() query: QueryAstrologyReportDto) {
        const page = await this.astrologyFortuneService.getAllReports(query);
        return {
            ...page,
            items: page.items.map(toConsoleAstrologyReport),
        };
    }

    @Get("reports/stats")
    reportStats(@Query() query: QueryAstrologyReportDto) {
        return this.astrologyFortuneService.getReportStats(query);
    }

    @Get("reports/:id")
    async reportDetail(@Param("id", UUIDValidationPipe) id: string) {
        return toConsoleAstrologyReport(await this.astrologyFortuneService.getAdminReportDetail(id));
    }

    @Post("reports/cleanup-stale")
    cleanupStaleReports() {
        return this.astrologyFortuneService.cleanupStaleReports();
    }

    @Delete("reports/:id")
    deleteReport(@Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.adminDeleteReport(id);
    }
}
