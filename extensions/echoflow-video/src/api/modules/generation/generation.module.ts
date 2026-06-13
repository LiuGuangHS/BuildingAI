import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { ExtensionBillingModule } from "@buildingai/extension-sdk";
import { Module } from "@nestjs/common";

import { BillingRuleController } from "./controllers/console/billing-rule.controller";
import { GenerationController } from "./controllers/console/generation.controller";
import { ModelConfigController } from "./controllers/console/model-config.controller";
import { PolicyController } from "./controllers/console/policy.controller";
import { ProviderConfigController } from "./controllers/console/provider-config.controller";
import { TemplateController } from "./controllers/console/template.controller";
import { BillingWebController } from "./controllers/web/billing.web.controller";
import { GenerationWebController } from "./controllers/web/generation.web.controller";
import { TemplateWebController } from "./controllers/web/template.web.controller";
import { WebhookController } from "./controllers/web/webhook.controller";
import {
    generationModuleEntities,
    generationModuleProviders,
    GenerationService,
} from "./services/generation.service";

@Module({
    imports: [TypeOrmModule.forFeature(generationModuleEntities), ExtensionBillingModule],
    controllers: [
        GenerationController,
        ProviderConfigController,
        ModelConfigController,
        BillingRuleController,
        PolicyController,
        TemplateController,
        GenerationWebController,
        BillingWebController,
        TemplateWebController,
        WebhookController,
    ],
    providers: generationModuleProviders,
    exports: [GenerationService],
})
export class GenerationModule {}
