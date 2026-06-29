import { createFal, type FalProvider as AISDKFalProvider } from "@ai-sdk/fal";
import type { Experimental_VideoModelV3, ImageModelV3, SpeechModelV3, TranscriptionModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";

export interface FalProviderSettings extends BaseProviderSettings {}

class FalProviderImpl implements AIProvider {
    readonly id = "fal";
    readonly name = "fal.ai";

    private baseProvider: AISDKFalProvider;

    constructor(settings: FalProviderSettings = {}) {
        this.baseProvider = createFal({
            apiKey: settings.apiKey,
            baseURL: settings.baseURL,
            headers: settings.headers,
        });
    }

    languageModel(): never {
        throw new Error("fal.ai provider does not support language models");
    }

    image(modelId: string): ImageModelV3 {
        return this.baseProvider.image(modelId);
    }

    video(modelId: string): Experimental_VideoModelV3 {
        return this.baseProvider.video(modelId);
    }

    speech(modelId: string): SpeechModelV3 {
        return this.baseProvider.speech(modelId);
    }

    transcription(modelId: string): TranscriptionModelV3 {
        return this.baseProvider.transcription(modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return [];
    }
}

export function fal(settings: FalProviderSettings = {}): AIProvider {
    return new FalProviderImpl(settings);
}
