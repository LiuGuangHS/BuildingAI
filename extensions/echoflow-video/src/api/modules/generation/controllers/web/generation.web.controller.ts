import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { webApiRateLimitGuard } from "../../../../common/guards/rate-limit.guard";
import { CreateVideoGenerationDto, OptimizePromptDto, QueryVideoGenerationDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";
import { PromptOptimizationService } from "../../services/prompt-optimization.service";
import { ProviderConfigService } from "../../services/provider-config.service";
import { TemplateService } from "../../services/template.service";

/**
 * Video generation controller for web (user-facing).
 * Mounted at /echoflow-video/api/generation
 */
@ExtensionWebController("generation")
export class GenerationWebController extends BaseController {
    constructor(
        private readonly generationService: GenerationService,
        private readonly providerConfigService: ProviderConfigService,
        private readonly templateService: TemplateService,
        private readonly promptOptimizationService: PromptOptimizationService,
    ) {
        super();
    }

    @Post()
    @UseGuards(webApiRateLimitGuard)
    async create(
        @Body() dto: CreateVideoGenerationDto,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.createAndSubmit(dto, user.id);
    }

    @Post("prompt/optimize")
    @UseGuards(webApiRateLimitGuard)
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
        return this.providerConfigService.getPublicStatus();
    }

    @Get("options/templates")
    @Public()
    async promptTemplates() {
        const result = await this.templateService.listPublicTemplates({ page: 1, pageSize: 20 });
        return {
            templates: result.items.map((item) => ({
                label: item.title,
                prompt: item.prompt,
                category: item.category,
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
