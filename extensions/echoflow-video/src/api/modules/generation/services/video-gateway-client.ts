import { HttpErrorFactory } from "@buildingai/errors";
import { Logger } from "@nestjs/common";

import type { VideoMediaItem } from "../../../db/entities/video-generation.entity";
import type { VideoModelEndpoint } from "../../../db/entities/video-model-config.entity";
import type { ResolvedVideoModelConfig } from "./model-config.service";
import { requestVideoJson, testVideoJsonEndpoint } from "./video-http-client";
import type { PollTaskOutput, SubmitTaskInput, SubmitTaskOutput } from "./video-provider.interface";
import { ECHOFLOW_VIDEO_MODEL } from "./video-model-catalog";

export class VideoGatewayClient {
    private readonly logger = new Logger(VideoGatewayClient.name);

    constructor(
        private readonly modelConfig: ResolvedVideoModelConfig,
        private readonly endpoint: VideoModelEndpoint,
        private readonly apiKey: string,
        private readonly baseUrl: string,
    ) {
        if (!apiKey) {
            throw HttpErrorFactory.badRequest(`模型 ${modelConfig.displayName} 的接入点主站密钥缺少 apiKey/api_key 字段`);
        }
        if (!baseUrl) {
            throw HttpErrorFactory.badRequest(`模型 ${modelConfig.displayName} 的接入点未配置 Base URL`);
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
        await testVideoJsonEndpoint(
            this.url(this.modelConfig.pollPath.replace("{id}", "echoflow-video-config-check")),
            { method: "GET", headers: this.headers() },
            {
                requestTimeoutMs: this.endpoint.testTimeoutMs ?? 15_000,
                serviceLabel: "视频接口",
                badRequestLabel: "视频接口请求参数有误",
            },
        );
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
        return requestVideoJson(
            url,
            { ...options, headers: this.headers() },
            {
                requestTimeoutMs: this.endpoint.requestTimeoutMs ?? 120_000,
                maxRetries: this.endpoint.maxRetries ?? 2,
                retryDelayMs: this.endpoint.retryDelayMs ?? 1_000,
                serviceLabel: "视频接口",
                badRequestLabel: "视频接口请求参数有误",
            },
        );
    }

    private url(path: string) {
        return `${this.baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
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
