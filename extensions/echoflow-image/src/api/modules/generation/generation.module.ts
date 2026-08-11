import { RedisModule, RedisService } from "@buildingai/cache";
import { QueueModule, UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { StorageConfig } from "@buildingai/db/entities";
import {
    AiPublicModule,
    ExtensionBillingModule,
    ExtensionNotificationModule,
    ExtensionRateLimitService,
} from "@buildingai/extension-sdk";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { BillingModule } from "../billing/billing.module";
import { ConfigModule } from "../config/config.module";
import { PolicyModule } from "../policy/policy.module";
import { GenerationController } from "./controllers/console/generation.controller";
import { GenerationWebController } from "./controllers/web/generation.web.controller";
import { ImageGenerationProcessor } from "./processors/image-generation.processor";
import { IMAGE_GENERATION_QUEUE } from "./services/generation-queue.constants";
import {
    generationModuleEntities,
    generationModuleProviders,
    GenerationService,
} from "./services/generation.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([...generationModuleEntities, StorageConfig]),
        ConfigModule,
        BillingModule,
        PolicyModule,
        UploadModule,
        AiPublicModule,
        ExtensionBillingModule,
        ExtensionNotificationModule,
        RedisModule,
        QueueModule,
        BullModule.registerQueue({ name: IMAGE_GENERATION_QUEUE }),
    ],
    controllers: [GenerationController, GenerationWebController],
    providers: [
        ...generationModuleProviders,
        {
            provide: ExtensionRateLimitService,
            useFactory: (redisService: RedisService) => new ExtensionRateLimitService(redisService),
            inject: [RedisService],
        },
        ImageGenerationProcessor,
    ],
    exports: [GenerationService],
})
export class GenerationModule {}
