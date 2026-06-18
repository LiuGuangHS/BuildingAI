import type { VideoMediaItem, VideoParameters } from "../../db/entities/video-generation.entity";

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

export interface VideoModelOption {
    id: string;
    name: string;
    model: string;
    modelType: string;
    description: string;
    mediaTypes: string[];
}

export interface VideoProviderClient {
    readonly providerId: string;
    submitTask(input: SubmitTaskInput): Promise<SubmitTaskOutput>;
    pollTask(taskId: string, model?: string): Promise<PollTaskOutput>;
    testConnection(): Promise<void>;
    listModels(): VideoModelOption[];
}

export interface ProviderRuntimeConfig {
    apiKey: string;
    clientOptions?: Record<string, unknown>;
}

export interface VideoProviderAdapter {
    readonly providerId: string;
    readonly displayName: string;
    readonly enabled: boolean;
    createClient(config: ProviderRuntimeConfig): VideoProviderClient;
}

export interface VideoProviderDescriptor {
    providerId: string;
    displayName: string;
    enabled: boolean;
    status: "ready" | "reserved";
    description: string;
}

/** Registry of available video provider adapters */
class ProviderRegistry {
    private readonly adapters = new Map<string, VideoProviderAdapter>();

    register(adapter: VideoProviderAdapter): void {
        this.adapters.set(adapter.providerId, adapter);
    }

    get(providerId: string): VideoProviderAdapter | undefined {
        return this.adapters.get(providerId);
    }

    list(): VideoProviderAdapter[] {
        return Array.from(this.adapters.values());
    }

    has(providerId: string): boolean {
        return this.adapters.has(providerId);
    }
}

/** Global provider registry singleton */
export const providerRegistry = new ProviderRegistry();
