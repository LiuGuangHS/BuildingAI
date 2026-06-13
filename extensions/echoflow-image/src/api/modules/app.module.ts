import { Module } from "@nestjs/common";

import { BillingModule } from "./billing/billing.module";
import { ConfigModule } from "./config/config.module";
import { GenerationModule } from "./generation/generation.module";
import { PolicyModule } from "./policy/policy.module";
import { TemplateModule } from "./template/template.module";

@Module({
    imports: [ConfigModule, BillingModule, PolicyModule, TemplateModule, GenerationModule],
    exports: [ConfigModule, BillingModule, PolicyModule, TemplateModule, GenerationModule],
})
export class AppModule {}
