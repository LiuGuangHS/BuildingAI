import type { ImageModelV3 } from "@ai-sdk/provider";

export interface GenerateImageParams {
    model: ImageModelV3;
    prompt: string;
    n?: number;
    size?: `${number}x${number}`;
    aspectRatio?: `${number}:${number}`;
    seed?: number;
    providerOptions?: Parameters<ImageModelV3["doGenerate"]>[0]["providerOptions"];
    abortSignal?: AbortSignal;
    headers?: Record<string, string | undefined>;
}

export interface GeneratedImageResult {
    base64?: string;
    uint8Array?: Uint8Array;
    mediaType?: string;
}

export interface GenerateImageResult {
    images: GeneratedImageResult[];
    warnings: Awaited<ReturnType<ImageModelV3["doGenerate"]>>["warnings"];
    providerMetadata?: Awaited<ReturnType<ImageModelV3["doGenerate"]>>["providerMetadata"];
    response: Awaited<ReturnType<ImageModelV3["doGenerate"]>>["response"];
}

export async function generateImage({
    model,
    prompt,
    n = 1,
    size,
    aspectRatio,
    seed,
    providerOptions = {},
    abortSignal,
    headers,
}: GenerateImageParams): Promise<GenerateImageResult> {
    const result = await model.doGenerate({
        prompt,
        n,
        size,
        aspectRatio,
        seed,
        files: undefined,
        mask: undefined,
        providerOptions,
        abortSignal,
        headers,
    });

    return {
        images: result.images.map((image) => typeof image === "string"
            ? { base64: image }
            : { uint8Array: image }),
        warnings: result.warnings,
        providerMetadata: result.providerMetadata,
        response: result.response,
    };
}
