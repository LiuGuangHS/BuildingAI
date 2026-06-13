import { BaseController } from "@buildingai/base";
import { ExtensionConsoleController } from "@buildingai/core/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

import { CreateBillingRuleDto, EstimateBillingDto, QueryBillingRuleDto, UpdateBillingRuleDto } from "../../dto";
import { BillingRuleService } from "../../services/billing-rule.service";

@ExtensionConsoleController("billing-rules", "Echoflow Image Billing")
export class BillingRuleController extends BaseController {
    constructor(private readonly billingRuleService: BillingRuleService) {
        super();
    }

    @Get()
    async findAll(@Query() query: QueryBillingRuleDto) {
        return this.billingRuleService.list(query);
    }

    @Post()
    async create(@Body() dto: CreateBillingRuleDto) {
        return this.billingRuleService.createRule(dto);
    }

    @Put(":id")
    async update(@Param("id", UUIDValidationPipe) id: string, @Body() dto: UpdateBillingRuleDto) {
        return this.billingRuleService.updateRule(id, dto);
    }

    @Delete(":id")
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        return this.billingRuleService.deleteRule(id);
    }

    @Post("estimate")
    async estimate(@Body() dto: EstimateBillingDto) {
        return this.billingRuleService.estimate(dto);
    }
}
