import { RedisModule, RedisService } from "@buildingai/cache";
import { QueueModule, UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    AiPublicModule,
    ExtensionBillingModule,
    ExtensionNotificationModule,
    ExtensionRateLimitService,
} from "@buildingai/extension-sdk";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ContractGenerationConfig, ContractGenerationTask, ContractGenerationVersion, ContractTemplateEntity } from "../../db/entities";
import { ContractGenerationConsoleController } from "./controllers/console/contract-generation.controller";
import { ContractGenerationWebController } from "./controllers/web/contract-generation.web.controller";
import { ContractGenerationProcessor } from "./processors/contract-generation.processor";
import { ContractGenerationService } from "./services";
import { CONTRACT_GENERATION_QUEUE } from "./services/contract-queue.constants";

@Module({
    imports: [
        TypeOrmModule.forFeature([ContractGenerationTask, ContractGenerationConfig, ContractGenerationVersion, ContractTemplateEntity]),
        AiPublicModule,
        ExtensionBillingModule,
        ExtensionNotificationModule,
        UploadModule,
        RedisModule,
        QueueModule,
        BullModule.registerQueue({ name: CONTRACT_GENERATION_QUEUE }),
    ],
    controllers: [ContractGenerationWebController, ContractGenerationConsoleController],
    providers: [
        ContractGenerationService,
        {
            provide: ExtensionRateLimitService,
            useFactory: (redisService: RedisService) => new ExtensionRateLimitService(redisService),
            inject: [RedisService],
        },
        ContractGenerationProcessor,
    ],
    exports: [ContractGenerationService],
})
export class ContractGenerationModule {}
