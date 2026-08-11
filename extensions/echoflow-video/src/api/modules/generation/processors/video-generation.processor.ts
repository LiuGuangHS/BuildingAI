import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { VideoGenerationStatus } from "../../../db/entities/video-generation.entity";
import { GenerationService } from "../services/generation.service";
import { VIDEO_GENERATION_JOB, VIDEO_GENERATION_QUEUE } from "../services/generation-queue.constants";

type VideoGenerationJobData = {
    id?: string;
};

@Processor(VIDEO_GENERATION_QUEUE)
export class VideoGenerationProcessor extends WorkerHost {
    private readonly logger = new Logger(VideoGenerationProcessor.name);

    constructor(private readonly generationService: GenerationService) {
        super();
    }

    async process(job: Job<VideoGenerationJobData>) {
        if (job.name !== VIDEO_GENERATION_JOB) {
            this.logger.warn(`Unknown video generation job: ${job.name}`);
            throw new Error("Unknown video generation job type");
        }

        const id = job.data?.id;
        if (!id) {
            this.logger.error(`Video generation job ${job.id} is missing id`);
            throw new Error("Missing video generation id");
        }

        try {
            await job.updateProgress(10);
            const generation = await this.generationService.executeGenerationJob(id);
            await job.updateProgress(100);
            return {
                success: generation.status === VideoGenerationStatus.SUCCEEDED,
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
        this.logger.log(`Video generation job completed: ${job.id}`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined) {
        this.logger.error(`Video generation job failed: ${job?.id ?? "unknown"}`);
    }
}
