import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateGenerationDto, PromptEnhanceDto, QueryGenerationDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";

@ExtensionWebController("generation")
export class GenerationWebController extends BaseController {
    constructor(private readonly generationService: GenerationService) {
        super();
    }

    @Post()
    async create(@Body() createGenerationDto: CreateGenerationDto, @Playground() user: UserPlayground) {
        return this.generationService.createAndGenerate(createGenerationDto, user.id);
    }

    @Post("prompt/enhance")
    async enhancePrompt(@Body() dto: PromptEnhanceDto) {
        return this.generationService.enhancePrompt(dto);
    }

    @Get()
    async findAll(@Query() queryGenerationDto: QueryGenerationDto, @Playground() user: UserPlayground) {
        return this.generationService.list(queryGenerationDto, user.id);
    }

    @Get("options/models")
    @Public()
    async listModels() {
        return this.generationService.listImageModels();
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        return this.generationService.findOwnedById(id, user.id);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        return this.generationService.deleteOwnedById(id, user.id);
    }

    @Post(":id/retry")
    async retry(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        return this.generationService.retry(id, user.id);
    }
}
