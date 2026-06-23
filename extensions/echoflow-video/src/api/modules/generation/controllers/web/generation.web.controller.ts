import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { ExtensionRateLimitService, type ExtensionRateLimitWindow } from "@buildingai/extension-sdk";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Param, Post, Query } from "@nestjs/common";

import { CreateVideoGenerationDto, OptimizePromptDto, QueryVideoGenerationDto, QueryVideoTemplateDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";
import { PromptOptimizationService } from "../../services/prompt-optimization.service";
import { TemplateService } from "../../services/template.service";

const VIDEO_RATE_LIMIT_WINDOWS: ExtensionRateLimitWindow[] = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
];

/**
 * Video generation controller for web (user-facing).
 * Mounted at /echoflow-video/api/generation
 */
@ExtensionWebController("generation")
export class GenerationWebController extends BaseController {
    constructor(
        private readonly generationService: GenerationService,
        private readonly templateService: TemplateService,
        private readonly promptOptimizationService: PromptOptimizationService,
        private readonly rateLimitService: ExtensionRateLimitService,
    ) {
        super();
    }

    @Post()
    async create(
        @Body() dto: CreateVideoGenerationDto,
        @Playground() user: UserPlayground,
    ) {
        await this.assertRateLimit("generation", user.id);
        return this.generationService.createAndSubmitForWeb(dto, user.id);
    }

    @Post("prompt/optimize")
    async optimizePrompt(@Body() dto: OptimizePromptDto, @Playground() user: UserPlayground) {
        await this.assertRateLimit("prompt-optimization", user.id);
        return this.promptOptimizationService.optimize(dto, user.id);
    }

    @Get("prompt/options")
    @Public()
    async promptOptimizerOptions() {
        return this.promptOptimizationService.getOptions();
    }

    @Get()
    async findAll(
        @Query() query: QueryVideoGenerationDto,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.listForWeb(query, user.id);
    }

    @Get("options/models")
    @Public()
    async listModels() {
        return this.generationService.listModels();
    }

    @Get("options/provider-status")
    @Public()
    async providerStatus() {
        const models = await this.generationService.listModels();
        return {
            available: models.length > 0,
            configured: models.length > 0,
            enabled: models.length > 0,
        };
    }

    @Get("options/templates")
    @Public()
    async promptTemplates(@Query() query: QueryVideoTemplateDto) {
        const result = await this.templateService.listPublicTemplates({
            ...query,
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 20,
        });
        return {
            templates: result.items.map((item) => ({
                label: item.title,
                prompt: item.prompt,
                category: item.category,
                abilityTypes: item.abilityTypes,
                modelConfigId: item.modelConfigId,
                defaultParams: item.defaultParams,
            })),
        };
    }

    @Get(":id")
    async findOne(
        @Param("id", UUIDValidationPipe) id: string,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.findOwnedPublicById(id, user.id);
    }

    @Get(":id/status")
    async checkStatus(
        @Param("id", UUIDValidationPipe) id: string,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.pollAndUpdateForWeb(id, user.id);
    }

    private async assertRateLimit(action: "generation" | "prompt-optimization", userId: string) {
        await this.rateLimitService.assertAllowed({
            namespace: "echoflow-video",
            action,
            subject: userId,
            windows: VIDEO_RATE_LIMIT_WINDOWS,
            message: "请求过于频繁，请稍后重试",
        });
    }
}
