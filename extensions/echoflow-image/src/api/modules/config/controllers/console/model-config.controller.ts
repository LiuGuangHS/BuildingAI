import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CreateModelConfigDto, QueryAvailableAiModelDto, QueryModelConfigDto, UpdateModelConfigDto } from "../../dto";
import { ModelConfigService } from "../../services/model-config.service";

@ExtensionConsoleController("model-configs", "Echoflow Image Model Config")
export class ModelConfigController extends BaseController {
    constructor(private readonly modelConfigService: ModelConfigService) {
        super();
    }

    @Get()
    async findAll(@Query() query: QueryModelConfigDto) {
        return this.modelConfigService.list(query);
    }

    @Get("available-ai-models")
    async listAvailableAiModels(@Query() query: QueryAvailableAiModelDto) {
        return this.modelConfigService.listAvailableAiModels(query);
    }

    @Post()
    async create(@Body() dto: CreateModelConfigDto) {
        return this.modelConfigService.createConfig(dto);
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string) {
        return this.modelConfigService.findByIdOrFail(id);
    }

    @Put(":id")
    async update(@Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateModelConfigDto) {
        return this.modelConfigService.updateConfig(id, dto);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.modelConfigService.deleteConfig(id);
    }

    @Post(":id/test")
    async test(@Param("id", UUIDValidationPipe) id: string) {
        return this.modelConfigService.testConfig(id);
    }
}
