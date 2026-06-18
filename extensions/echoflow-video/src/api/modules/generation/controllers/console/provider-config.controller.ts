import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Body, Delete, Get, Post, Query } from "@nestjs/common";

import { UpdateProviderConfigDto } from "../../dto";
import { ProviderConfigService } from "../../services/provider-config.service";

@ExtensionConsoleController("config", "Echoflow Video Config")
export class ProviderConfigController extends BaseController {
    constructor(
        private readonly providerConfigService: ProviderConfigService,
    ) {
        super();
    }

    @Get()
    async getConfig() {
        return this.providerConfigService.getConsoleConfig();
    }

    @Get("prompt-optimizer-models")
    async listPromptOptimizerModels() {
        return this.providerConfigService.listPromptOptimizerModels();
    }

    @Get("audits")
    async listAudits(@Query("limit") limit?: string) {
        return this.providerConfigService.listAudits(Number(limit) || 50);
    }

    @Post()
    async updateConfig(@Body() dto: UpdateProviderConfigDto, @Playground() user: UserPlayground) {
        return this.providerConfigService.updateConsoleConfig(dto, user.id);
    }

    @Delete()
    async clearConfig(@Playground() user: UserPlayground) {
        return this.providerConfigService.clearConsoleConfig(user.id);
    }
}
