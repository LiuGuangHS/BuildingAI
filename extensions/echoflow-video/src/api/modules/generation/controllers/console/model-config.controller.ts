import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Param, Post, Put, Query } from "@nestjs/common";

import {
    QueryVideoModelConfigDto,
    UpdateVideoModelConfigDto,
    VideoModelEndpointDto,
} from "../../dto";
import { ModelConfigService } from "../../services/model-config.service";

@ExtensionConsoleController("models", "Echoflow Video Models")
export class ModelConfigController extends BaseController {
    constructor(private readonly modelConfigService: ModelConfigService) {
        super();
    }

    @Get()
    async list(@Query() query: QueryVideoModelConfigDto) {
        return this.modelConfigService.list(query);
    }

    @Put(":id")
    async update(
        @Param("id", UUIDValidationPipe) id: string,
        @Body() dto: UpdateVideoModelConfigDto,
    ) {
        return this.modelConfigService.updateConfig(id, dto);
    }

    @Post(":id/test-endpoint")
    async testEndpoint(
        @Param("id", UUIDValidationPipe) id: string,
        @Body() dto: VideoModelEndpointDto,
    ) {
        return this.modelConfigService.testEndpoint(id, dto);
    }
}
