import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { ImageModelConfig } from "../../db/entities/image-model-config.entity";
import { ImageBillingRule } from "../../db/entities/image-billing-rule.entity";
import { ImageGeneration } from "../../db/entities/image-generation.entity";
import { ImagePolicyConfig } from "../../db/entities/image-policy-config.entity";
import { ModelConfigController } from "./controllers/console/model-config.controller";
import { ModelOptionsWebController } from "./controllers/web/model-options.web.controller";
import { ModelConfigService } from "./services/model-config.service";

@Module({
    imports: [TypeOrmModule.forFeature([ImageModelConfig, ImageBillingRule, ImageGeneration, ImagePolicyConfig, AiModel])],
    controllers: [ModelConfigController, ModelOptionsWebController],
    providers: [ModelConfigService],
    exports: [ModelConfigService],
})
export class ConfigModule {}
