import { ExtensionWebController } from "@buildingai/core/decorators";
import { Public } from "@buildingai/decorators/public.decorator";
import { Body, Headers, HttpCode, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

import { GenerationService } from "../../services/generation.service";
import { ProviderConfigService } from "../../services/provider-config.service";

class HappyHorseWebhookDto {
    @IsString()
    @IsOptional()
    task_id?: string;

    @IsString()
    @IsOptional()
    taskId?: string;

    @IsString()
    @IsNotEmpty()
    status?: string;

    @IsString()
    @IsOptional()
    state?: string;

    @IsObject()
    @IsOptional()
    output?: {
        task_id?: string;
        task_status?: string;
        video_url?: string;
        videoUrl?: string;
    };
}

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
        @Body() body: HappyHorseWebhookDto,
        @Headers("x-webhook-secret") secret?: string,
    ) {
        const verified = await this.providerConfigService.verifyHappyHorseWebhookSecret(secret);
        if (!verified) {
            this.logger.warn("Webhook received with invalid or missing signature");
            throw new HttpException("Invalid webhook secret", HttpStatus.UNAUTHORIZED);
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
            throw new HttpException("Webhook processing failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return { received: true };
    }
}
