import { HttpErrorFactory } from "@buildingai/errors";
import { Logger } from "@nestjs/common";

import type { HappyHorseModel, VideoMediaItem, VideoParameters } from "../../../db/entities/video-generation.entity";
import type { SubmitTaskInput, SubmitTaskOutput, PollTaskOutput, VideoProviderClient, VideoModelOption } from "./video-provider.interface";

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
            throw HttpErrorFactory.badRequest("HappyHorse 未配置 API Key，请在 Echoflow Video 管理后台完成配置");
        }
        this.apiKey = apiKey;
        this.options = {
            ...defaultHappyHorseClientOptions,
            ...options,
            baseUrl: normalizeBaseUrl(options.baseUrl ?? defaultHappyHorseClientOptions.baseUrl),
        };
    }

    async testConnection(): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.testTimeoutMs);

        try {
            const response = await fetch(`${this.options.baseUrl}/alibailian/tasks/echoflow-video-config-check`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
            });

            if (response.status === 404) {
                return;
            }

            if (!response.ok) {
                const responseText = await response.text();
                throw classifyHttpError(response.status, responseText, 0);
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw HttpErrorFactory.badRequest("HappyHorse 连接测试超时，请稍后重试");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
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
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            try {
                return await this.executeRequest(url, options, attempt);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (!this.isRetryable(lastError)) {
                    throw lastError;
                }

                if (attempt < this.options.maxRetries) {
                    const delay = this.options.retryDelayMs * Math.pow(2, attempt);
                    await sleep(delay);
                }
            }
        }

        throw lastError ?? new Error("HappyHorse 请求失败");
    }

    private async executeRequest(
        url: string,
        options: { method: string; body?: string },
        attempt: number,
    ): Promise<Record<string, unknown>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);

        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            };

            const response = await fetch(url, {
                method: options.method,
                headers,
                body: options.body,
                signal: controller.signal,
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw classifyHttpError(response.status, responseText, attempt);
            }

            return safeJsonParse(responseText) ?? {};
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private isRetryable(error: Error): boolean {
        const message = error.message || "";
        return (
            message.includes("429") ||
            message.includes("500") ||
            message.includes("502") ||
            message.includes("503") ||
            message.includes("504") ||
            message.includes("timeout") ||
            message.includes("ETIMEDOUT") ||
            message.includes("ECONNRESET") ||
            message.includes("aborted")
        );
    }
}

function normalizeBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
        throw HttpErrorFactory.badRequest("HappyHorse Base URL 不能为空");
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw HttpErrorFactory.badRequest("HappyHorse Base URL 格式不正确");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw HttpErrorFactory.badRequest("HappyHorse Base URL 仅支持 http/https");
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest("HappyHorse Base URL 不允许包含用户名或密码");
    }
    if (isPrivateOrLocalHost(url.hostname)) {
        throw HttpErrorFactory.badRequest("HappyHorse Base URL 不允许指向本机或内网地址");
    }

    return trimmed;
}

function isPrivateOrLocalHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local") ||
        host.startsWith("10.") ||
        host.startsWith("127.") ||
        host.startsWith("169.254.") ||
        host.startsWith("192.168.") ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
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

function classifyHttpError(status: number, body: string, attempt: number): Error {
    const prefix = attempt > 0 ? `(重试 ${attempt} 次后) ` : "";
    const truncated = body.length > 500 ? body.slice(0, 500) + "..." : body;

    switch (status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}请求参数有误: ${truncated}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无效或已过期`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无权限访问该模型`);
        case 429:
            return HttpErrorFactory.badRequest(`${prefix}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return HttpErrorFactory.badRequest(`${prefix}视频服务暂时不可用 (${status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}请求失败: ${status} ${truncated}`);
    }
}

function safeJsonParse<T>(value: string): T | undefined {
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
