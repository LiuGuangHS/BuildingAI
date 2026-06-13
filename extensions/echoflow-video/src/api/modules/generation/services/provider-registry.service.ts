import { Injectable } from "@nestjs/common";

import { HappyHorseClient, type HappyHorseClientOptions } from "./happyhorse-client";
import type {
    ProviderRuntimeConfig,
    VideoProviderAdapter,
    VideoProviderDescriptor,
} from "./video-provider.interface";

class HappyHorseAdapter implements VideoProviderAdapter {
    readonly providerId = "happyhorse";
    readonly displayName = "HappyHorse";
    readonly enabled = true;

    createClient(config: ProviderRuntimeConfig) {
        return new HappyHorseClient(
            config.apiKey,
            (config.clientOptions ?? {}) as HappyHorseClientOptions,
        );
    }
}

const reservedProviders: VideoProviderDescriptor[] = [
    {
        providerId: "kling",
        displayName: "Kling",
        enabled: false,
        status: "reserved",
        description: "预留供应商，待真实 API 合同和计费策略确认后接入",
    },
    {
        providerId: "seedance",
        displayName: "Seedance / ARK",
        enabled: false,
        status: "reserved",
        description: "预留供应商，待真实 API 合同和计费策略确认后接入",
    },
    {
        providerId: "dashscope-video",
        displayName: "DashScope Video",
        enabled: false,
        status: "reserved",
        description: "预留供应商，待真实 API 合同和计费策略确认后接入",
    },
    {
        providerId: "runninghub",
        displayName: "RunningHub / ComfyUI",
        enabled: false,
        status: "reserved",
        description: "工作流型供应商预留，后续需要独立素材、队列和工作流配置",
    },
];

@Injectable()
export class ProviderRegistryService {
    private readonly adapters = new Map<string, VideoProviderAdapter>([
        ["happyhorse", new HappyHorseAdapter()],
    ]);

    getAdapter(providerId: string): VideoProviderAdapter | undefined {
        return this.adapters.get(providerId);
    }

    listProviders(): VideoProviderDescriptor[] {
        const readyProviders = Array.from(this.adapters.values()).map((adapter) => ({
            providerId: adapter.providerId,
            displayName: adapter.displayName,
            enabled: adapter.enabled,
            status: "ready" as const,
            description: "已接入提交、轮询、Webhook 和错误归一化基础能力",
        }));
        return [...readyProviders, ...reservedProviders];
    }
}
