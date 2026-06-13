import { UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { BillingModule } from "../billing/billing.module";
import { ConfigModule } from "../config/config.module";
import { PolicyModule } from "../policy/policy.module";
import { GenerationController } from "./controllers/console/generation.controller";
import { GenerationWebController } from "./controllers/web/generation.web.controller";
import {
    generationModuleEntities,
    generationModuleProviders,
    GenerationService,
} from "./services/generation.service";

@Module({
    imports: [
        TypeOrmModule.forFeature(generationModuleEntities),
        ConfigModule,
        BillingModule,
        PolicyModule,
        UploadModule,
    ],
    controllers: [GenerationController, GenerationWebController],
    providers: generationModuleProviders,
    exports: [GenerationService],
})
export class GenerationModule {}
