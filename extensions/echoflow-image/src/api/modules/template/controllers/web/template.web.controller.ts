import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { Get, Query } from "@nestjs/common";

import { QueryTemplateDto } from "../../dto";
import { TemplateService } from "../../services/template.service";

@ExtensionWebController("templates")
export class TemplateWebController extends BaseController {
    constructor(private readonly templateService: TemplateService) {
        super();
    }

    @Get()
    async findAll(@Query() query: QueryTemplateDto) {
        return this.templateService.list(query, true);
    }
}
