import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { VideoGenerationStatus } from "../../../db/entities/video-generation.entity";
import { GenerationService } from "../services/generation.service";
import { VIDEO_POLL_JOB, VIDEO_POLL_QUEUE } from "../services/video-poll-queue.constants";

type VideoPollJobData = {
    id?: string;
};

@Processor(VIDEO_POLL_QUEUE)
export class VideoPollProcessor extends WorkerHost {
    private readonly logger = new Logger(VideoPollProcessor.name);

    constructor(private readonly generationService: GenerationService) {
        super();
    }

    async process(job: Job<VideoPollJobData>) {
        if (job.name !== VIDEO_POLL_JOB) {
            this.logger.warn(`Unknown video poll job: ${job.name}`);
            return { success: false, reason: "Unknown job type" };
        }

        const id = job.data?.id;
        if (!id) {
            this.logger.error(`Video poll job ${job.id} is missing id`);
            return { success: false, reason: "Missing generation id" };
        }

        await job.updateProgress(10);
        const generation = await this.generationService.pollAnyAndUpdate(id, { scheduleNext: true });
        await job.updateProgress(100);
        return {
            success: generation.status === VideoGenerationStatus.SUCCEEDED,
            id,
            status: generation.status,
        };
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`Video poll job completed: ${job.id}`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(`Video poll job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    }
}
