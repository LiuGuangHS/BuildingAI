import { ExtensionWebController } from "@buildingai/core/decorators";
import { Public } from "@buildingai/decorators/public.decorator";
import { Body, Headers, HttpCode, Logger, Post } from "@nestjs/common";

import { GenerationService } from "../../services/generation.service";
import { ProviderConfigService } from "../../services/provider-config.service";

/**
 * Webhook endpoint for HappyHorse async task status callbacks.
 * Mounted at /echoflow-video/api/webhook/happyhorse
 */
@ExtensionWebController("webhook")
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly generationService: GenerationService,
        private readonly providerConfigService: ProviderConfigService,
    ) {}

    @Public()
    @Post("happyhorse")
    @HttpCode(200)
    async handleWebhook(
        @Body() body: {
            task_id?: string;
            taskId?: string;
            status?: string;
            state?: string;
            output?: { task_id?: string; task_status?: string; video_url?: string; videoUrl?: string };
        },
        @Headers("x-webhook-secret") secret?: string,
    ) {
        const verified = await this.providerConfigService.verifyHappyHorseWebhookSecret(secret);
        if (!verified) {
            this.logger.warn("Webhook received with invalid or missing secret");
            return { received: true };
        }

        const taskId = body.task_id ?? body.taskId ?? body.output?.task_id;
        if (!taskId) {
            return { received: true };
        }

        try {
            await this.generationService.processWebhookUpdate(
                taskId,
                body.status ?? body.state ?? body.output?.task_status ?? "unknown",
                body.output?.video_url ?? body.output?.videoUrl,
            );
        } catch (error) {
            this.logger.error(`Webhook handler failed for task ${taskId}`, error);
        }

        return { received: true };
    }
}
