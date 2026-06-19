import { HttpErrorFactory } from "@buildingai/errors";
import { Logger } from "@nestjs/common";

import type { HappyHorseModel, VideoMediaItem, VideoParameters } from "../../../db/entities/video-generation.entity";
import type { SubmitTaskInput, SubmitTaskOutput, PollTaskOutput, VideoProviderClient, VideoModelOption } from "./video-provider.interface";
import { normalizeVideoBaseUrl, requestVideoJson, testVideoJsonEndpoint } from "./video-http-client";

export interface HappyHorseClientOptions {
    baseUrl?: string;
    requestTimeoutMs?: number;
    testTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

export const defaultHappyHorseClientOptions = {
    baseUrl: "https://api.echoflow.cn",
    requestTimeoutMs: 120_000,
    testTimeoutMs: 15_000,
    maxRetries: 2,
    retryDelayMs: 1_000,
} satisfies Required<HappyHorseClientOptions>;

export class HappyHorseClient implements VideoProviderClient {
    readonly providerId = "happyhorse";
    private readonly apiKey: string;
    private readonly options: Required<HappyHorseClientOptions>;
    private readonly logger = new Logger(HappyHorseClient.name);

    constructor(apiKey: string, options: HappyHorseClientOptions = {}) {
        if (!apiKey) {
            throw HttpErrorFactory.badRequest("视频模型接入点绑定的主站密钥缺少 apiKey/api_key 字段");
        }
        this.apiKey = apiKey;
        this.options = {
            ...defaultHappyHorseClientOptions,
            ...options,
            baseUrl: normalizeVideoBaseUrl(
                options.baseUrl ?? defaultHappyHorseClientOptions.baseUrl,
                "HappyHorse Base URL",
            ),
        };
    }

    async testConnection(): Promise<void> {
        await testVideoJsonEndpoint(
            `${this.options.baseUrl}/alibailian/tasks/echoflow-video-config-check`,
            { method: "GET", headers: this.headers() },
            {
                requestTimeoutMs: this.options.testTimeoutMs,
                serviceLabel: "HappyHorse",
                badRequestLabel: "请求参数有误",
            },
        );
    }

    /** Return hardcoded HappyHorse model options. */
    listModels(): VideoModelOption[] {
        return [
            { id: "happyhorse-1.0-i2v", name: "HappyHorse 图生视频 (i2v)", model: "happyhorse-1.0-i2v", modelType: "image-to-video", description: "上传一张首帧图片 + 提示词，生成视频", mediaTypes: ["first_frame"] },
            { id: "happyhorse-1.0-r2v", name: "HappyHorse 参考图生视频 (r2v)", model: "happyhorse-1.0-r2v", modelType: "reference-to-video", description: "上传 1-4 张参考图 + 提示词，生成视频", mediaTypes: ["reference_image"] },
            { id: "happyhorse-1.0-t2v", name: "HappyHorse 文生视频 (t2v)", model: "happyhorse-1.0-t2v", modelType: "text-to-video", description: "纯文本提示词生成视频，无需上传图片", mediaTypes: [] },
            { id: "happyhorse-1.0-video-edit", name: "HappyHorse 视频编辑 (video-edit)", model: "happyhorse-1.0-video-edit", modelType: "video-edit", description: "上传视频 + 可选参考图 + 提示词，编辑/变换视频", mediaTypes: ["video", "reference_image"] },
        ];
    }

    /** Submit a video generation task. Returns the task_id. */
    async submitTask(input: SubmitTaskInput): Promise<SubmitTaskOutput> {
        const body = this.buildRequest(input);

        this.logger.log(`Submitting ${input.model} task: prompt=${input.prompt.slice(0, 80)}... media=${input.media?.length ?? 0} items`);

        const result = await this.fetchWithRetry(
            `${this.options.baseUrl}/alibailian/api/v1/services/aigc/video-generation/video-synthesis`,
            {
                method: "POST",
                body: JSON.stringify(body),
            },
        );

        const taskId = result?.output?.task_id;
        if (!taskId) {
            throw HttpErrorFactory.badRequest(
                `HappyHorse 未返回 task_id，响应: ${JSON.stringify(result).slice(0, 300)}`,
            );
        }

        this.logger.log(`Task submitted: task_id=${taskId}`);
        return { taskId, rawRequest: body, rawResponse: result };
    }

    /** Poll the task status. Returns the status and optionally the video_url. */
    async pollTask(taskId: string): Promise<PollTaskOutput> {
        const data = await this.fetchWithRetry(
            `${this.options.baseUrl}/alibailian/tasks/${taskId}`,
            { method: "GET" },
        );

        const status = data.status ?? data.state ?? data.output?.task_status ?? "unknown";
        const videoUrl: string | undefined =
            data.output?.video_url ?? data.output?.videoUrl ?? data.video_url;

        if (videoUrl) {
            this.logger.log(`Task ${taskId} video ready: ${videoUrl}`);
        }

        return {
            status: String(status),
            videoUrl,
            rawResponse: data,
        };
    }

    /** Build the request body for the HappyHorse synthesis endpoint. */
    private buildRequest(input: SubmitTaskInput): Record<string, unknown> {
        const body: Record<string, unknown> = {
            model: input.model,
            input: {
                prompt: input.prompt,
            },
            parameters: {
                ...input.parameters,
            },
        };

        // Attach media if present
        if (input.media && input.media.length > 0) {
            (body.input as Record<string, unknown>).media = input.media;
        }

        return body;
    }

    /** Fetch with retry + timeout. */
    private async fetchWithRetry(
        url: string,
        options: { method: string; body?: string },
    ): Promise<Record<string, unknown>> {
        return requestVideoJson(
            url,
            { ...options, headers: this.headers() },
            {
                requestTimeoutMs: this.options.requestTimeoutMs,
                maxRetries: this.options.maxRetries,
                retryDelayMs: this.options.retryDelayMs,
                serviceLabel: "视频服务",
                badRequestLabel: "请求参数有误",
            },
        );
    }

    private headers(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
    }
}

/** Determine if a status string represents a terminal success state. */
export function isSuccessStatus(status: string): boolean {
    return ["succeeded", "success", "SUCCEEDED"].includes(status);
}

/** Determine if a status string represents a terminal failure state. */
export function isFailedStatus(status: string): boolean {
    return ["failed", "cancelled", "FAILED", "CANCELED"].includes(status);
}

/** Determine if a status string represents a terminal state (success or failure). */
export function isTerminalStatus(status: string): boolean {
    return isSuccessStatus(status) || isFailedStatus(status);
}
