import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { ImageBillingRule } from "../../db/entities/image-billing-rule.entity";
import { ImageModelConfig } from "../../db/entities/image-model-config.entity";
import { BillingRuleController } from "./controllers/console/billing-rule.controller";
import { BillingWebController } from "./controllers/web/billing.web.controller";
import { BillingRuleService } from "./services/billing-rule.service";

@Module({
    imports: [TypeOrmModule.forFeature([ImageBillingRule, ImageModelConfig])],
    controllers: [BillingRuleController, BillingWebController],
    providers: [BillingRuleService],
    exports: [BillingRuleService],
})
export class BillingModule {}
