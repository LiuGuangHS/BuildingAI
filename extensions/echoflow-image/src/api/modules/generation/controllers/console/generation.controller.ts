import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { HttpErrorFactory } from "@buildingai/errors";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";

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
        this.assertConsoleManageAccess(user);
        return this.generationService.createAndGenerateForConsole(createGenerationDto, user.id);
    }

    @Post("jobs/recover")
    async recoverJobs(@Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.recoverJobs();
    }

    @Get()
    async findAll(@Query() queryGenerationDto: QueryGenerationDto, @Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.listAll(queryGenerationDto);
    }

    @Get("options/models")
    async listModels(@Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.listImageModels();
    }

    @Get("results/:generationId/:fileId")
    async downloadResult(
        @Param("generationId", UUIDValidationPipe) generationId: string,
        @Param("fileId", UUIDValidationPipe) fileId: string,
        @Playground() user: UserPlayground,
        @Res() response: Response,
    ) {
        return this.generationService.getGenerationResultStream(generationId, fileId, user.id, response, user);
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.findConsoleById(id);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.deleteById(id);
    }

    @Post(":id/retry")
    async retry(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
        this.assertConsoleManageAccess(user);
        return this.generationService.retryForConsole(id);
    }

    private assertConsoleManageAccess(user: UserPlayground): void {
        if (user.isRoot === 1 || user.permissions.includes("echoflow-image@generation:manage")) return;
        throw HttpErrorFactory.forbidden("权限不足");
    }
}
