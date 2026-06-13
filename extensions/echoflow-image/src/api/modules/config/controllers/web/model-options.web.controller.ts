import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Get, Param } from "@nestjs/common";

import { ModelConfigService } from "../../services/model-config.service";

@ExtensionWebController("model-options")
export class ModelOptionsWebController extends BaseController {
    constructor(private readonly modelConfigService: ModelConfigService) {
        super();
    }

    @Get()
    async listModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

    @Get(":id")
    async findOne(@Param("id", UUIDValidationPipe) id: string) {
        const config = await this.modelConfigService.findEnabledById(id);
        return this.modelConfigService.toWebOption(config);
    }
}
