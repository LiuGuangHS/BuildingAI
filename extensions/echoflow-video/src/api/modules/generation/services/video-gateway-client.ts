import { HttpErrorFactory } from "@buildingai/errors";
import { Logger } from "@nestjs/common";

import type { VideoMediaItem } from "../../../db/entities/video-generation.entity";
import type { VideoModelEndpoint } from "../../../db/entities/video-model-config.entity";
import type { ResolvedVideoModelConfig } from "./model-config.service";
import type { PollTaskOutput, SubmitTaskInput, SubmitTaskOutput } from "./video-provider.interface";
import { ECHOFLOW_VIDEO_MODEL } from "./video-model-catalog";

export class VideoGatewayClient {
    private readonly logger = new Logger(VideoGatewayClient.name);

    constructor(
        private readonly modelConfig: ResolvedVideoModelConfig,
        private readonly endpoint: VideoModelEndpoint,
        private readonly apiKey: string,
    ) {
        if (!apiKey) {
            throw HttpErrorFactory.badRequest(`模型 ${modelConfig.displayName} 的接入点未配置 API Key`);
        }
    }

    async submitTask(input: SubmitTaskInput): Promise<SubmitTaskOutput> {
        const body = this.buildRequest(input);
        const result = await this.fetchWithRetry(this.url(this.modelConfig.submitPath), {
            method: "POST",
            body: JSON.stringify(body),
        });
        const taskId = extractTaskId(result);
        if (!taskId) {
            throw HttpErrorFactory.badRequest(`视频接口未返回任务 ID，响应: ${JSON.stringify(result).slice(0, 300)}`);
        }
        this.logger.log(`Video task submitted: model=${this.modelConfig.model} taskId=${taskId}`);
        return { taskId, rawRequest: body, rawResponse: result };
    }

    async pollTask(taskId: string): Promise<PollTaskOutput> {
        const data = await this.fetchWithRetry(
            this.url(this.modelConfig.pollPath.replace("{id}", encodeURIComponent(taskId))),
            { method: "GET" },
        );
        return {
            status: extractStatus(data),
            videoUrl: extractVideoUrl(data),
            rawResponse: data,
        };
    }

    async testConnection(): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.endpoint.testTimeoutMs ?? 15_000);
        try {
            const response = await fetch(this.url(this.modelConfig.pollPath.replace("{id}", "echoflow-video-config-check")), {
                method: "GET",
                headers: this.headers(),
                signal: controller.signal,
            });
            if (response.status === 404) {
                return;
            }
            if ([401, 403].includes(response.status)) {
                throw HttpErrorFactory.badRequest("API Key 无效或无权限访问该模型");
            }
            if (!response.ok) {
                const responseText = await response.text();
                throw classifyHttpError(response.status, responseText, 0);
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw HttpErrorFactory.badRequest("视频接口连接测试超时，请稍后重试");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private buildRequest(input: SubmitTaskInput): Record<string, unknown> {
        const model = this.modelConfig.model;
        if (model === ECHOFLOW_VIDEO_MODEL.SEEDANCE_1_5_PRO ||
            model === ECHOFLOW_VIDEO_MODEL.SEEDANCE_2_0) {
            return {
                model: this.modelConfig.externalModelId,
                content: this.buildSeedanceContent(input),
                generate_audio: true,
                ratio: input.parameters?.ratio,
                duration: input.parameters?.duration,
                watermark: input.parameters?.watermark,
            };
        }

        if (model === ECHOFLOW_VIDEO_MODEL.KLING_TEXT2VIDEO) {
            return {
                model_name: this.modelConfig.externalModelId,
                prompt: input.prompt,
                mode: "std",
                duration: String(input.parameters?.duration ?? 5),
                aspect_ratio: input.parameters?.ratio,
                multi_shot: false,
                sound: "off",
                watermark_info: { enabled: Boolean(input.parameters?.watermark) },
            };
        }

        if (model === ECHOFLOW_VIDEO_MODEL.KLING_IMAGE2VIDEO) {
            const firstFrame = this.requireMedia(input.media, "first_frame", 1, 1)[0];
            return {
                model_name: this.modelConfig.externalModelId,
                image: firstFrame.url,
                prompt: input.prompt,
                mode: "std",
                duration: String(input.parameters?.duration ?? 5),
                sound: "off",
                watermark_info: { enabled: Boolean(input.parameters?.watermark) },
            };
        }

        if (model === ECHOFLOW_VIDEO_MODEL.KLING_MULTI_IMAGE2VIDEO) {
            const references = this.requireMedia(input.media, "reference_image", 1, 4);
            return {
                model_name: this.modelConfig.externalModelId,
                image_list: references.map((item) => ({ image: item.url })),
                prompt: input.prompt,
                mode: "std",
                duration: String(input.parameters?.duration ?? 5),
                aspect_ratio: input.parameters?.ratio,
            };
        }

        return {
            model: this.modelConfig.externalModelId,
            input: {
                prompt: input.prompt,
                ...(input.media?.length ? { media: input.media } : {}),
            },
            parameters: {
                ...input.parameters,
            },
        };
    }

    private buildSeedanceContent(input: SubmitTaskInput) {
        return [
            { type: "text", text: input.prompt, role: "user" },
            ...(input.media ?? []).map((item) => ({
                type: item.type === "video" ? "video_url" : "image_url",
                role: "user",
                ...(item.type === "video"
                    ? { video_url: { url: item.url } }
                    : { image_url: { url: item.url } }),
            })),
        ];
    }

    private requireMedia(
        media: VideoMediaItem[] | undefined,
        type: VideoMediaItem["type"],
        min: number,
        max: number,
    ) {
        const items = (media ?? []).filter((item) => item.type === type);
        if (items.length < min || items.length > max) {
            throw HttpErrorFactory.badRequest(`当前模型需要 ${min === max ? min : `${min}-${max}`} 个${type === "first_frame" ? "首帧图片" : "参考图"}`);
        }
        return items;
    }

    private async fetchWithRetry(
        url: string,
        options: { method: string; body?: string },
    ): Promise<Record<string, unknown>> {
        let lastError: Error | undefined;
        const maxRetries = this.endpoint.maxRetries ?? 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.executeRequest(url, options, attempt);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (!isRetryable(lastError) || attempt >= maxRetries) {
                    throw lastError;
                }
                await sleep((this.endpoint.retryDelayMs ?? 1_000) * Math.pow(2, attempt));
            }
        }
        throw lastError ?? new Error("视频接口请求失败");
    }

    private async executeRequest(
        url: string,
        options: { method: string; body?: string },
        attempt: number,
    ): Promise<Record<string, unknown>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.endpoint.requestTimeoutMs ?? 120_000);
        try {
            const response = await fetch(url, {
                method: options.method,
                headers: this.headers(),
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

    private url(path: string) {
        return `${this.endpoint.baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    }

    private headers() {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
}

function extractTaskId(data: Record<string, unknown>): string | undefined {
    return pickString(data, [
        "id",
        "task_id",
        "taskId",
        "output.task_id",
        "output.taskId",
        "data.id",
        "data.task_id",
        "data.taskId",
    ]);
}

function extractStatus(data: Record<string, unknown>): string {
    return pickString(data, [
        "status",
        "state",
        "task_status",
        "output.task_status",
        "output.status",
        "data.status",
        "data.task_status",
    ]) ?? "unknown";
}

function extractVideoUrl(data: Record<string, unknown>): string | undefined {
    return pickString(data, [
        "content.video_url",
        "content.videoUrl",
        "output.video_url",
        "output.videoUrl",
        "output.video.url",
        "data.video_url",
        "data.videoUrl",
        "data.task_result.videos.0.url",
        "task_result.videos.0.url",
        "video_url",
        "videoUrl",
        "url",
    ]);
}

function pickString(data: unknown, paths: string[]): string | undefined {
    for (const path of paths) {
        const value = getPath(data, path);
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
}

function getPath(data: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((value, key) => {
        if (value == null) return undefined;
        if (Array.isArray(value)) return value[Number(key)];
        if (typeof value === "object") return (value as Record<string, unknown>)[key];
        return undefined;
    }, data);
}

function isRetryable(error: Error): boolean {
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

function classifyHttpError(status: number, body: string, attempt: number): Error {
    const prefix = attempt > 0 ? `(重试 ${attempt} 次后) ` : "";
    const truncated = body.length > 500 ? body.slice(0, 500) + "..." : body;
    switch (status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}视频接口请求参数有误: ${truncated}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无效或已过期`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无权限访问该模型`);
        case 429:
            return HttpErrorFactory.badRequest(`${prefix}视频接口请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return HttpErrorFactory.badRequest(`${prefix}视频服务暂时不可用 (${status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}视频接口请求失败: ${status} ${truncated}`);
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
