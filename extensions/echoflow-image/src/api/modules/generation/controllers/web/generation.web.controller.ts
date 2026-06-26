import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { ExtensionRateLimitService, type ExtensionRateLimitWindow } from "@buildingai/extension-sdk";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateGenerationDto, PromptEnhanceDto, QueryGenerationDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";

const IMAGE_RATE_LIMIT_WINDOWS: ExtensionRateLimitWindow[] = [
    { suffix: "short", ttlSeconds: 10, limit: 5 },
    { suffix: "minute", ttlSeconds: 60, limit: 20 },
];

@ExtensionWebController("generation")
export class GenerationWebController extends BaseController {
    constructor(
        private readonly generationService: GenerationService,
        private readonly rateLimitService: ExtensionRateLimitService,
    ) {
        super();
    }

    @Post()
    async create(@Body() createGenerationDto: CreateGenerationDto, @Playground() user: UserPlayground) {
        await this.assertRateLimit("generation", user.id);
        return this.generationService.createAndGenerateForWeb(createGenerationDto, user.id);
    }

    @Post("prompt/enhance")
    async enhancePrompt(@Body() dto: PromptEnhanceDto, @Playground() user: UserPlayground) {
        await this.assertRateLimit("prompt-enhancement", user.id);
        return this.generationService.enhancePrompt(dto);
    }

    @Get()
    async findAll(@Query() queryGenerationDto: QueryGenerationDto, @Playground() user: UserPlayground) {
        return this.generationService.listForWeb(queryGenerationDto, user.id);
    }

    @Get("options/models")
    @Public()
    async listModels() {
        return this.generationService.listImageModels();
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        return this.generationService.findOwnedPublicById(id, user.id);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        return this.generationService.deleteOwnedById(id, user.id);
    }

    @Post(":id/retry")
    async retry(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        await this.assertRateLimit("generation", user.id);
        return this.generationService.retryForWeb(id, user.id);
    }

    private async assertRateLimit(action: "generation" | "prompt-enhancement", userId: string) {
        await this.rateLimitService.assertAllowed({
            namespace: "echoflow-image",
            action,
            subject: userId,
            windows: IMAGE_RATE_LIMIT_WINDOWS,
            message: "请求过于频繁，请稍后重试",
        });
    }
}
