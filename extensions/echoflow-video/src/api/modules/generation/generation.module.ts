import { RedisModule, RedisService } from "@buildingai/cache";
import { QueueModule, SecretModule, UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    AiPublicModule,
    ExtensionBillingModule,
    ExtensionNotificationModule,
    ExtensionRateLimitService,
} from "@buildingai/extension-sdk";
import { BullModule } from "@nestjs/bullmq";
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
import { VideoPollProcessor } from "./processors/video-poll.processor";
import { VIDEO_POLL_QUEUE } from "./services/video-poll-queue.constants";

@Module({
    imports: [
        TypeOrmModule.forFeature(generationModuleEntities),
        AiPublicModule,
        ExtensionBillingModule,
        ExtensionNotificationModule,
        SecretModule,
        UploadModule,
        RedisModule,
        QueueModule,
        BullModule.registerQueue({ name: VIDEO_POLL_QUEUE }),
    ],
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
    providers: [
        ...generationModuleProviders,
        {
            provide: ExtensionRateLimitService,
            useFactory: (redisService: RedisService) => new ExtensionRateLimitService(redisService),
            inject: [RedisService],
        },
        VideoPollProcessor,
    ],
    exports: [GenerationService],
})
export class GenerationModule {}
