import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { Public } from "@buildingai/decorators/public.decorator";
import { Get, Query } from "@nestjs/common";

import { QueryVideoTemplateDto } from "../../dto";
import { TemplateService } from "../../services/template.service";

@ExtensionWebController("templates")
export class TemplateWebController extends BaseController {
    constructor(private readonly templateService: TemplateService) {
        super();
    }

    @Get()
    @Public()
    async findAll(@Query() query: QueryVideoTemplateDto) {
        return this.templateService.listPublicTemplates(query);
    }
}
