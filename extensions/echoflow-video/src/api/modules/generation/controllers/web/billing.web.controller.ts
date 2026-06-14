import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { Public } from "@buildingai/decorators";
import { Body, Post } from "@nestjs/common";

import { EstimateVideoBillingDto } from "../../dto";
import { BillingRuleService } from "../../services/billing-rule.service";

@ExtensionWebController("billing")
export class BillingWebController extends BaseController {
    constructor(private readonly billingRuleService: BillingRuleService) {
        super();
    }

    @Post("estimate")
    @Public()
    async estimate(@Body() dto: EstimateVideoBillingDto) {
        return this.billingRuleService.estimate(dto);
    }
}
