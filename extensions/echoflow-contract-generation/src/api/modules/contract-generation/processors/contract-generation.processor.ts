import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { ContractGenerationStatus } from "../../../db/entities";
import { CONTRACT_GENERATION_JOB, CONTRACT_GENERATION_QUEUE } from "../services/contract-queue.constants";
import { ContractGenerationService } from "../services";

type ContractGenerationJobData = {
    id?: string;
    processingAttemptId?: string | null;
};

@Processor(CONTRACT_GENERATION_QUEUE)
export class ContractGenerationProcessor extends WorkerHost {
    private readonly logger = new Logger(ContractGenerationProcessor.name);

    constructor(private readonly contractGenerationService: ContractGenerationService) {
        super();
    }

    async process(job: Job<ContractGenerationJobData>) {
        if (!Object.values(CONTRACT_GENERATION_JOB).includes(job.name as (typeof CONTRACT_GENERATION_JOB)[keyof typeof CONTRACT_GENERATION_JOB])) {
            this.logger.warn(`Unknown contract generation job: ${job.name}`);
            return { success: false, reason: "Unknown job type" };
        }

        const id = job.data?.id;
        if (!id) {
            this.logger.error(`Contract generation job ${job.id} is missing id`);
            return { success: false, reason: "Missing task id" };
        }

        try {
            await job.updateProgress(10);
            const task = await this.contractGenerationService.executeTaskJob(id, job.name, job.data?.processingAttemptId ?? undefined);
            await job.updateProgress(100);
            return {
                success: task?.status === ContractGenerationStatus.DRAFT,
                id,
                status: task?.status ?? "missing",
            };
        } catch (error) {
            await this.contractGenerationService.markTaskCrashed(id, error, job.data?.processingAttemptId ?? undefined);
            throw error;
        }
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`Contract generation job completed: ${job.id}`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(`Contract generation job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    }
}
