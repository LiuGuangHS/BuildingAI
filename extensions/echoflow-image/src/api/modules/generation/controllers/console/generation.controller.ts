import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateGenerationDto, QueryGenerationDto } from "../../dto";
import { GenerationService } from "../../services/generation.service";

@ExtensionConsoleController("generation", "Echoflow Image Generation")
export class GenerationController extends BaseController {
    constructor(private readonly generationService: GenerationService) {
        super();
    }

    @Post()
    async create(
        @Body() createGenerationDto: CreateGenerationDto,
        @Playground() user: UserPlayground,
    ) {
        return this.generationService.createAndGenerate(createGenerationDto, user.id);
    }

    @Post("jobs/recover")
    async recoverJobs() {
        return this.generationService.recoverJobs();
    }

    @Get()
    async findAll(@Query() queryGenerationDto: QueryGenerationDto) {
        return this.generationService.listAll(queryGenerationDto);
    }

    @Get("options/models")
    async listModels() {
        return this.generationService.listImageModels();
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.findById(id);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.deleteById(id);
    }

    @Post(":id/retry")
    async retry(@Param("id", UUIDValidationPipe) id: string) {
        return this.generationService.retryAsOwner(id);
    }
}
