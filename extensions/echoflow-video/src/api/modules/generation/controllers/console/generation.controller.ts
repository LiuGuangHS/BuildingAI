import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import {
    BatchVideoIdsDto,
    BatchVideoStatusDto,
    MarkVideoStatusDto,
    QueryVideoGenerationDto,
    UpdateVideoAdminRemarkDto,
} from "../../dto";
import { GenerationService } from "../../services/generation.service";

/**
 * Video generation management controller for console (admin-facing).
 * Mounted at /echoflow-video/consoleapi/generation
 */
@ExtensionConsoleController("generation", "Echoflow Video Generation")
export class GenerationController extends BaseController {
    constructor(private readonly generationService: GenerationService) {
        super();
    }

    /** List all generation records (admin — no user filter). */
    @Get()
    async findAll(@Query() query: QueryVideoGenerationDto) {
        return this.generationService.list(query);
    }

    @Get("options/models")
    async listModels() {
        return this.generationService.listModels();
    }

    @Get("health")
    async healthCheck() {
        return this.generationService.healthCheck();
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.findGenerationById(id);
    }

    @Post("batch/status")
    async batchRefreshStatus(@Body() body: BatchVideoStatusDto) {
        return this.generationService.batchPollAndUpdate(body.status, body.limit);
    }

    @Post("batch/mark-failed")
    async batchMarkFailed(@Body() body: BatchVideoIdsDto) {
        return this.generationService.batchMarkFailed(body.ids);
    }

    @Post("batch/cancel")
    async batchCancel(@Body() body: BatchVideoIdsDto) {
        return this.generationService.batchCancel(body.ids);
    }

    @Post("batch/retry")
    async batchRetry(@Body() body: BatchVideoIdsDto) {
        return this.generationService.batchRetry(body.ids);
    }

    @Post("batch/stale")
    async scanStaleProcessing() {
        return this.generationService.scanStaleProcessing();
    }

    @Post(":id/status")
    async refreshStatus(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.pollAnyAndUpdate(id);
    }

    @Post(":id/mark-status")
    async markStatus(
        @Param("id", UUIDValidationPipe) id: string,
        @Body() body: MarkVideoStatusDto,
    ) {
        return this.generationService.markStatus(id, body.status, body.message, body.failureCategory);
    }

    @Post(":id/cancel")
    async cancel(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.cancelRecord(id);
    }

    @Post(":id/retry")
    async retry(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.retryRecord(id);
    }

    @Post(":id/remark")
    async updateRemark(
        @Param("id", UUIDValidationPipe) id: string,
        @Body() body: UpdateVideoAdminRemarkDto,
    ) {
        return this.generationService.updateAdminRemark(id, body.adminRemark);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.deleteOne(id);
    }
}
