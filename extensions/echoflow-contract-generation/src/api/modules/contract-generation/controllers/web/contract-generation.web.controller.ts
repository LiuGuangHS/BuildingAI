import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { ExportContractDto, GenerateContractDto, QueryContractTaskDto, ReviewUploadedContractDto, RewriteContractClauseDto, UpdateContractContentDto, UpdateRiskActionDto } from "../../dto";
import { ContractGenerationService } from "../../services";

@ExtensionWebController("contract-generation")
export class ContractGenerationWebController extends BaseController {
    constructor(private readonly contractGenerationService: ContractGenerationService) {
        super();
    }

    @Get("templates")
    templates() {
        return this.contractGenerationService.listTemplates();
    }

    @Get("config")
    config() {
        return this.contractGenerationService.getPublicConfig();
    }

    @Post("generate")
    generate(@Playground() user: UserPlayground, @Body() dto: GenerateContractDto) {
        return this.contractGenerationService.generate(user.id, dto);
    }

    @Post("review-upload")
    reviewUpload(@Playground() user: UserPlayground, @Body() dto: ReviewUploadedContractDto) {
        return this.contractGenerationService.reviewUploadedContract(user.id, dto);
    }

    @Post("tasks/:id/review")
    review(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.reviewTask(user.id, id);
    }

    @Post("tasks/:id/rewrite-clause")
    rewriteClause(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: RewriteContractClauseDto) {
        return this.contractGenerationService.rewriteClause(user.id, id, dto);
    }

    @Patch("tasks/:id/content")
    updateContent(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateContractContentDto) {
        return this.contractGenerationService.updateTaskContent(user.id, id, dto);
    }

    @Patch("tasks/:id/risk-actions")
    updateRiskAction(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateRiskActionDto) {
        return this.contractGenerationService.updateRiskAction(user.id, id, dto);
    }

    @Get("tasks/:id/versions")
    versions(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.getTaskVersions(user.id, id);
    }

    @Post("tasks/:id/versions/:versionId/restore")
    restoreVersion(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Param("versionId", UUIDValidationPipe) versionId: string) {
        return this.contractGenerationService.restoreTaskVersion(user.id, id, versionId);
    }

    @Post("tasks/:id/export")
    exportTask(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: ExportContractDto, @Req() request: Request) {
        return this.contractGenerationService.exportTask(user.id, id, request, dto);
    }

    @Get("tasks")
    list(@Playground() user: UserPlayground, @Query() query: QueryContractTaskDto) {
        return this.contractGenerationService.getUserTasks(user.id, query);
    }

    @Get("tasks/:id")
    detail(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.getTaskDetail(user.id, id);
    }

    @Delete("tasks/:id")
    remove(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.deleteTask(user.id, id);
    }
}
