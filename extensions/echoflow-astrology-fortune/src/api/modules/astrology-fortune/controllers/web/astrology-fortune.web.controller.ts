import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { ExtensionRateLimitService, type ExtensionRateLimitWindow } from "@buildingai/extension-sdk";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CreateAstrologyProfileDto, GenerateAstrologyReportDto, QueryAstrologyProfileDto, QueryAstrologyReportDto, UpdateAstrologyProfileDto, UpdateFavoriteDto, UpdateReportFeedbackDto } from "../../dto";
import { AstrologyFortuneService } from "../../services";

const ASTROLOGY_RATE_LIMIT_WINDOWS: ExtensionRateLimitWindow[] = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
];

@ExtensionWebController("astrology-fortune")
export class AstrologyFortuneWebController extends BaseController {
    constructor(
        private readonly astrologyFortuneService: AstrologyFortuneService,
        private readonly rateLimitService: ExtensionRateLimitService,
    ) {
        super();
    }

    @Get("generation-status")
    getPublicGenerationStatus() {
        return this.astrologyFortuneService.getPublicGenerationStatus();
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
    async generateReport(@Playground() user: UserPlayground, @Body() dto: GenerateAstrologyReportDto) {
        await this.assertRateLimit("report-generation", user.id);
        return this.toPublicReport(await this.astrologyFortuneService.generateReport(user.id, dto));
    }

    @Get("reports")
    async listReports(@Playground() user: UserPlayground, @Query() query: QueryAstrologyReportDto) {
        const page = await this.astrologyFortuneService.listUserReports(user.id, query);
        return {
            ...page,
            items: page.items.map((item) => this.toPublicReport(item)),
        };
    }

    @Get("reports/:id")
    async reportDetail(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.toPublicReport(await this.astrologyFortuneService.getReportDetail(user.id, id));
    }

    @Patch("reports/:id/favorite")
    async updateFavorite(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateFavoriteDto) {
        return this.toPublicReport(await this.astrologyFortuneService.updateFavorite(user.id, id, dto.isFavorite));
    }

    @Patch("reports/:id/feedback")
    async updateFeedback(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateReportFeedbackDto) {
        return this.toPublicReport(await this.astrologyFortuneService.updateReportFeedback(user.id, id, dto));
    }

    @Delete("reports/:id")
    deleteReport(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.astrologyFortuneService.deleteReport(user.id, id);
    }

    private async assertRateLimit(action: "report-generation", userId: string) {
        await this.rateLimitService.assertAllowed({
            namespace: "echoflow-astrology-fortune",
            action,
            subject: userId,
            windows: ASTROLOGY_RATE_LIMIT_WINDOWS,
            message: "请求过于频繁，请稍后重试",
        });
    }

    private toPublicReport(report: Awaited<ReturnType<AstrologyFortuneService["generateReport"]>> | Awaited<ReturnType<AstrologyFortuneService["listUserReports"]>>["items"][number] | Awaited<ReturnType<AstrologyFortuneService["getReportDetail"]>> | Awaited<ReturnType<AstrologyFortuneService["updateFavorite"]>> | Awaited<ReturnType<AstrologyFortuneService["updateReportFeedback"]>>) {
        const {
            userId: _userId,
            modelId: _modelId,
            providerId: _providerId,
            requestPayload: _requestPayload,
            deletedAt: _deletedAt,
            errorMessage,
            providerMetadata,
            ...publicReport
        } = report;
        return {
            ...publicReport,
            errorMessage: errorMessage ? "报告生成失败，请稍后重试" : undefined,
            providerMetadata: {
                feedback: providerMetadata?.feedback,
                sourceReport: providerMetadata?.sourceReport,
                generationContext: providerMetadata?.generationContext,
            },
        };
    }
}
