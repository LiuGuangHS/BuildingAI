import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { AstrologyReportStatus } from "../../../db/entities";
import { ASTROLOGY_REPORT_JOB, ASTROLOGY_REPORT_QUEUE } from "../services/astrology-queue.constants";
import { AstrologyFortuneService } from "../services";

type AstrologyReportJobData = {
    id?: string;
};

@Processor(ASTROLOGY_REPORT_QUEUE)
export class AstrologyReportProcessor extends WorkerHost {
    private readonly logger = new Logger(AstrologyReportProcessor.name);

    constructor(private readonly astrologyFortuneService: AstrologyFortuneService) {
        super();
    }

    async process(job: Job<AstrologyReportJobData>) {
        if (job.name !== ASTROLOGY_REPORT_JOB) {
            this.logger.warn(`Unknown astrology report job: ${job.name}`);
            return { success: false, reason: "Unknown job type" };
        }

        const id = job.data?.id;
        if (!id) {
            this.logger.error(`Astrology report job ${job.id} is missing id`);
            return { success: false, reason: "Missing report id" };
        }

        try {
            await job.updateProgress(10);
            const report = await this.astrologyFortuneService.executeReportJob(id);
            await job.updateProgress(100);
            return {
                success: report?.status === AstrologyReportStatus.SUCCESS,
                id,
                status: report?.status ?? "missing",
            };
        } catch (error) {
            await this.astrologyFortuneService.markReportCrashed(id, error, {
                failureType: "worker_job_failed",
            });
            throw error;
        }
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`Astrology report job completed: ${job.id}`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(`Astrology report job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    }
}
