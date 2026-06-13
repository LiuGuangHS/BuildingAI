import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CreateVideoTemplateDto, QueryVideoTemplateDto, UpdateVideoTemplateDto } from "../../dto";
import { TemplateService } from "../../services/template.service";

@ExtensionConsoleController("templates", "Echoflow Video Templates")
export class TemplateController extends BaseController {
    constructor(private readonly templateService: TemplateService) {
        super();
    }

    @Get()
    async findAll(@Query() query: QueryVideoTemplateDto) {
        return this.templateService.list(query);
    }

    @Post()
    async create(@Body() dto: CreateVideoTemplateDto) {
        return this.templateService.createTemplate(dto);
    }

    @Put(":id")
    async update(@Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateVideoTemplateDto) {
        return this.templateService.updateTemplate(id, dto);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.templateService.deleteTemplate(id);
    }
}
