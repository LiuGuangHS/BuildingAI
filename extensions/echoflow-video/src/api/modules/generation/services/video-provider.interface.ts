import type { VideoMediaItem, VideoParameters } from "../../../db/entities/video-generation.entity";

export interface SubmitTaskInput {
    model: string;
    prompt: string;
    media?: VideoMediaItem[];
    parameters?: VideoParameters;
}

export interface SubmitTaskOutput {
    taskId: string;
    rawRequest: Record<string, unknown>;
    rawResponse: Record<string, unknown>;
}

export interface PollTaskOutput {
    status: string;
    videoUrl?: string;
    rawResponse: Record<string, unknown>;
}
