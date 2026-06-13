import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CreateTemplateDto, QueryTemplateDto, UpdateTemplateDto } from "../../dto";
import { TemplateService } from "../../services/template.service";

@ExtensionConsoleController("templates", "Echoflow Image Templates")
export class TemplateController extends BaseController {
    constructor(private readonly templateService: TemplateService) {
        super();
    }

    @Get()
    async findAll(@Query() query: QueryTemplateDto) {
        return this.templateService.list(query);
    }

    @Post()
    async create(@Body() dto: CreateTemplateDto) {
        return this.templateService.createTemplate(dto);
    }

    @Put(":id")
    async update(@Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateTemplateDto) {
        return this.templateService.updateTemplate(id, dto);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.templateService.deleteTemplate(id);
    }
}
