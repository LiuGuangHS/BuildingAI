import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { QueryContractTaskDto, UpdateContractConfigDto, UpsertContractTemplateDto } from "../../dto";
import { ContractGenerationService } from "../../services";

@ExtensionConsoleController("contract-generation", "AI合同管理")
export class ContractGenerationConsoleController extends BaseController {
    constructor(private readonly contractGenerationService: ContractGenerationService) {
        super();
    }

    @Get("templates")
    templates() {
        return this.contractGenerationService.listAdminTemplates();
    }

    @Post("templates")
    createTemplate(@Body() dto: UpsertContractTemplateDto) {
        return this.contractGenerationService.createTemplate(dto);
    }

    @Patch("templates/:id")
    updateTemplate(@Param("id", UUIDValidationPipe) id: string, @Body() dto: UpsertContractTemplateDto) {
        return this.contractGenerationService.updateTemplate(id, dto);
    }

    @Delete("templates/:id")
    deleteTemplate(@Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.deleteTemplate(id);
    }

    @Post("templates/reset-builtin")
    resetBuiltinTemplates() {
        return this.contractGenerationService.resetBuiltinTemplates();
    }

    @Get("config")
    config() {
        return this.contractGenerationService.getAdminConfig();
    }

    @Get("ai-models")
    aiModels() {
        return this.contractGenerationService.listAvailableLlmModels();
    }

    @Patch("config")
    updateConfig(@Body() dto: UpdateContractConfigDto) {
        return this.contractGenerationService.updateAdminConfig(dto);
    }

    @Get("tasks")
    list(@Query() query: QueryContractTaskDto) {
        return this.contractGenerationService.getAllTasks(query);
    }

    @Get("tasks/:id")
    detail(@Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.getAdminTaskDetail(id);
    }

    @Delete("tasks/:id")
    remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.contractGenerationService.adminDeleteTask(id);
    }
}
