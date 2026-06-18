import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { ImageGenerationStatus } from "../../../db/entities/image-generation.entity";
import { GenerationService } from "../services/generation.service";
import { IMAGE_GENERATION_JOB, IMAGE_GENERATION_QUEUE } from "../services/generation-queue.constants";

type ImageGenerationJobData = {
    id?: string;
};

@Processor(IMAGE_GENERATION_QUEUE)
export class ImageGenerationProcessor extends WorkerHost {
    private readonly logger = new Logger(ImageGenerationProcessor.name);

    constructor(private readonly generationService: GenerationService) {
        super();
    }

    async process(job: Job<ImageGenerationJobData>) {
        if (job.name !== IMAGE_GENERATION_JOB) {
            this.logger.warn(`Unknown image generation job: ${job.name}`);
            return { success: false, reason: "Unknown job type" };
        }

        const id = job.data?.id;
        if (!id) {
            this.logger.error(`Image generation job ${job.id} is missing id`);
            return { success: false, reason: "Missing generation id" };
        }

        try {
            await job.updateProgress(10);
            const generation = await this.generationService.executeGenerationJob(id);
            await job.updateProgress(100);
            return {
                success: generation.status === ImageGenerationStatus.SUCCEEDED,
                id,
                status: generation.status,
            };
        } catch (error) {
            await this.generationService.markGenerationCrashed(id, error);
            throw error;
        }
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`Image generation job completed: ${job.id}`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(`Image generation job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    }
}
