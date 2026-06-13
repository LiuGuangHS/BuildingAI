import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Param, Put } from "@nestjs/common";

import { UpsertVideoPolicyDto } from "../../dto";
import { PolicyService } from "../../services/policy.service";

@ExtensionConsoleController("policies", "Echoflow Video Policy")
export class PolicyController extends BaseController {
    constructor(private readonly policyService: PolicyService) {
        super();
    }

    @Get()
    async findAll() {
        return this.policyService.listPolicies();
    }

    @Put("global")
    async upsertGlobal(@Body() dto: UpsertVideoPolicyDto) {
        return this.policyService.upsertGlobal(dto);
    }

    @Put("model/:modelConfigId")
    async upsertModel(
        @Param("modelConfigId", UUIDValidationPipe) modelConfigId: string,
        @Body() dto: UpsertVideoPolicyDto,
    ) {
        return this.policyService.upsertModel(modelConfigId, dto);
    }
}
