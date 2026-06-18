import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { ImageModelConfig } from "../../db/entities/image-model-config.entity";
import { ImagePolicyConfig } from "../../db/entities/image-policy-config.entity";
import { PolicyController } from "./controllers/console/policy.controller";
import { PolicyService } from "./services/policy.service";

@Module({
    imports: [TypeOrmModule.forFeature([ImagePolicyConfig, ImageModelConfig])],
    controllers: [PolicyController],
    providers: [PolicyService],
    exports: [PolicyService],
})
export class PolicyModule {}
