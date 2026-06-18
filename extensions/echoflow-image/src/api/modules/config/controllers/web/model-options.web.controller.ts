import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { Public } from "@buildingai/decorators/public.decorator";
import { Get } from "@nestjs/common";

import { ModelConfigService } from "../../services/model-config.service";

@ExtensionWebController("model-options")
export class ModelOptionsWebController extends BaseController {
    constructor(private readonly modelConfigService: ModelConfigService) {
        super();
    }

    @Get()
    @Public()
    async listModels() {
        return this.modelConfigService.listEnabledForWeb();
    }

}
