import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { ExtensionRateLimitService, type ExtensionRateLimitWindow } from "@buildingai/extension-sdk";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { ExportContractDto, GenerateContractDto, QueryContractTaskDto, ReviewUploadedContractDto, RewriteContractClauseDto, UpdateContractContentDto, UpdateRiskActionDto } from "../../dto";
import { ContractGenerationService } from "../../services";

const CONTRACT_RATE_LIMIT_WINDOWS: ExtensionRateLimitWindow[] = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
];

@ExtensionWebController("contract-generation")
export class ContractGenerationWebController extends BaseController {
    constructor(
        private readonly contractGenerationService: ContractGenerationService,
        private readonly rateLimitService: ExtensionRateLimitService,
    ) {
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
    async generate(@Playground() user: UserPlayground, @Body() dto: GenerateContractDto) {
        await this.assertRateLimit("generate", user.id);
        return this.toPublicTask(await this.contractGenerationService.generate(user.id, dto));
    }

    @Post("review-upload")
    async reviewUpload(@Playground() user: UserPlayground, @Body() dto: ReviewUploadedContractDto) {
        await this.assertRateLimit("review-upload", user.id);
        return this.toPublicTask(await this.contractGenerationService.reviewUploadedContract(user.id, dto));
    }

    @Post("tasks/:id/review")
    async review(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        await this.assertRateLimit("review-task", user.id);
        return this.toPublicTask(await this.contractGenerationService.reviewTask(user.id, id));
    }

    @Post("tasks/:id/rewrite-clause")
    async rewriteClause(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: RewriteContractClauseDto) {
        await this.assertRateLimit("rewrite-clause", user.id);
        return this.contractGenerationService.rewriteClause(user.id, id, dto);
    }

    @Patch("tasks/:id/content")
    async updateContent(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateContractContentDto) {
        return this.toPublicTask(await this.contractGenerationService.updateTaskContent(user.id, id, dto));
    }

    @Patch("tasks/:id/risk-actions")
    async updateRiskAction(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateRiskActionDto) {
        return this.toPublicTask(await this.contractGenerationService.updateRiskAction(user.id, id, dto));
    }

    @Get("tasks/:id/versions")
    versions(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.getTaskVersions(user.id, id);
    }

    @Post("tasks/:id/versions/:versionId/restore")
    async restoreVersion(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Param("versionId", UUIDValidationPipe) versionId: string) {
        return this.toPublicTask(await this.contractGenerationService.restoreTaskVersion(user.id, id, versionId));
    }

    @Post("tasks/:id/export")
    async exportTask(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string, @Body() dto: ExportContractDto, @Req() request: Request) {
        await this.assertRateLimit("export", user.id);
        return this.toPublicTask(await this.contractGenerationService.exportTask(user.id, id, request, dto));
    }

    @Get("tasks")
    async list(@Playground() user: UserPlayground, @Query() query: QueryContractTaskDto) {
        const page = await this.contractGenerationService.getUserTasks(user.id, query);
        return {
            ...page,
            items: page.items.map((item) => this.toPublicTask(item)),
        };
    }

    @Get("tasks/:id")
    async detail(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.toPublicTask(await this.contractGenerationService.getTaskDetail(user.id, id));
    }

    @Delete("tasks/:id")
    remove(@Playground() user: UserPlayground, @Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.deleteTask(user.id, id);
    }

    private async assertRateLimit(
        action: "generate" | "review-upload" | "review-task" | "rewrite-clause" | "export",
        userId: string,
    ) {
        await this.rateLimitService.assertAllowed({
            namespace: "echoflow-contract-generation",
            action,
            subject: userId,
            windows: CONTRACT_RATE_LIMIT_WINDOWS,
            message: "请求过于频繁，请稍后重试",
        });
    }

    private toPublicTask(task: Awaited<ReturnType<ContractGenerationService["generate"]>> | Awaited<ReturnType<ContractGenerationService["reviewUploadedContract"]>> | Awaited<ReturnType<ContractGenerationService["reviewTask"]>> | Awaited<ReturnType<ContractGenerationService["updateTaskContent"]>> | Awaited<ReturnType<ContractGenerationService["updateRiskAction"]>> | Awaited<ReturnType<ContractGenerationService["restoreTaskVersion"]>> | Awaited<ReturnType<ContractGenerationService["exportTask"]>> | Awaited<ReturnType<ContractGenerationService["getTaskDetail"]>>) {
        const {
            userId: _userId,
            modelId: _modelId,
            providerId: _providerId,
            requestPayload: _requestPayload,
            providerMetadata,
            deletedAt: _deletedAt,
            ...publicTask
        } = task;
        return {
            ...publicTask,
            providerMetadata: {
                templateName: providerMetadata?.templateName,
                language: providerMetadata?.language,
                stance: providerMetadata?.stance,
                exportedAt: providerMetadata?.exportedAt,
                exportType: providerMetadata?.exportType,
                billingStatus: providerMetadata?.billingStatus,
                refundedAt: providerMetadata?.refundedAt,
            },
        };
    }
}
