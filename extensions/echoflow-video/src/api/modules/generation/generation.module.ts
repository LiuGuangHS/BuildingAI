import { RedisModule } from "@buildingai/cache";
import { QueueModule, SecretModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    AiPublicModule,
    ExtensionBillingModule,
    ExtensionNotificationModule,
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
import { VideoRequestLimiterService } from "./services/video-request-limiter.service";

@Module({
    imports: [
        TypeOrmModule.forFeature(generationModuleEntities),
        AiPublicModule,
        ExtensionBillingModule,
        ExtensionNotificationModule,
        SecretModule,
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
    providers: [...generationModuleProviders, VideoRequestLimiterService, VideoPollProcessor],
    exports: [GenerationService],
})
export class GenerationModule {}
