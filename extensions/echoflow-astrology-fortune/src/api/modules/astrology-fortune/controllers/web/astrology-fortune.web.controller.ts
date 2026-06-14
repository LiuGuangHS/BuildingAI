import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CreateAstrologyProfileDto, GenerateAstrologyReportDto, QueryAstrologyProfileDto, QueryAstrologyReportDto, UpdateAstrologyProfileDto, UpdateFavoriteDto } from "../../dto";
import { AstrologyFortuneService } from "../../services";

@ExtensionWebController("astrology-fortune")
export class AstrologyFortuneWebController extends BaseController {
    constructor(private readonly astrologyFortuneService: AstrologyFortuneService) {
        super();
    }

    @Post("profiles")
    createProfile(@Playground() user: UserPlayground, @Body() dto: CreateAstrologyProfileDto) {
        return this.astrologyFortuneService.createProfile(user.id, dto);
    }

    @Get("profiles")
    listProfiles(@Playground() user: UserPlayground, @Query() query: QueryAstrologyProfileDto) {
        return this.astrologyFortuneService.listUserProfiles(user.id, query);
    }

    @Get("profiles/:id")
    profileDetail(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.getProfileDetail(user.id, id);
    }

    @Patch("profiles/:id")
    updateProfile(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateAstrologyProfileDto) {
        return this.astrologyFortuneService.updateProfile(user.id, id, dto);
    }

    @Delete("profiles/:id")
    deleteProfile(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.deleteProfile(user.id, id);
    }

    @Post("reports/generate")
    generateReport(@Playground() user: UserPlayground, @Body() dto: GenerateAstrologyReportDto) {
        return this.astrologyFortuneService.generateReport(user.id, dto);
    }

    @Get("reports")
    listReports(@Playground() user: UserPlayground, @Query() query: QueryAstrologyReportDto) {
        return this.astrologyFortuneService.listUserReports(user.id, query);
    }

    @Get("reports/:id")
    reportDetail(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.getReportDetail(user.id, id);
    }

    @Patch("reports/:id/favorite")
    updateFavorite(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateFavoriteDto) {
        return this.astrologyFortuneService.updateFavorite(user.id, id, dto.isFavorite);
    }

    @Delete("reports/:id")
    deleteReport(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.deleteReport(user.id, id);
    }
}
