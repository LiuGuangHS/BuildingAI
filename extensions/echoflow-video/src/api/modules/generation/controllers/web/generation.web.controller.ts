import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { WebApiRateLimitGuard } from "../../../../common/guards/rate-limit.guard";
import { CreateVideoGenerationDto, OptimizePromptDto, QueryVideoGenerationDto, QueryVideoTemplateDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";
import { PromptOptimizationService } from "../../services/prompt-optimization.service";
import { TemplateService } from "../../services/template.service";

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
    ) {
        super();
    }

    @Post()
    @UseGuards(WebApiRateLimitGuard)
    async create(
        @Body() dto: CreateVideoGenerationDto,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.createAndSubmit(dto, user.id);
    }

    @Post("prompt/optimize")
    @UseGuards(WebApiRateLimitGuard)
    async optimizePrompt(@Body() dto: OptimizePromptDto, @Playground() user: UserPlayground) {
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
        return this.generationService.list(query, user.id);
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
        return this.generationService.findOwnedById(id, user.id);
    }

    @Get(":id/status")
    async checkStatus(
        @Param("id", UUIDValidationPipe) id: string,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.pollAndUpdate(id, user.id);
    }
}
