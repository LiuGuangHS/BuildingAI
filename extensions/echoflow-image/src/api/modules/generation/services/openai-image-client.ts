import { HttpErrorFactory } from "@buildingai/errors";
import { buildDefinedWhere, safeJsonParse } from "@buildingai/extension-sdk/utils/pure";

import { type GeneratedImageRecord } from "../../../db/entities/image-generation.entity";
import type { ImageRequestContract } from "../../../db/entities/image-model-config.entity";
import { DEFAULT_IMAGE_GATEWAY_BASE_URL } from "../../config/services/image-model-catalog";
import {
    buildImageFilename,
    downloadReferenceImageFromUrl,
    normalizeImageBaseURL,
    normalizeImageMimeType,
    requestImageResponseText,
} from "./image-http-client";

export interface OpenAIImageClientConfig {
    apiKey?: string;
    baseURL?: string;
}

export interface GenerateOpenAIImageOptions {
    model: string;
    prompt: string;
    n?: number;
    size?: string;
    quality?: string;
    style?: string;
    responseFormat?: string;
    outputFormat?: string;
    background?: string;
    outputCompression?: number;
    inputFidelity?: string;
    moderation?: string;
    seed?: string | number;
    negativePrompt?: string;
    referenceImages?: ReferenceImageInput[];
    maskImage?: ReferenceImageInput;
    maxReferenceImageBytes?: number;
    requestContract?: ImageRequestContract;
}

export interface ReferenceImageInput {
    url?: string;
    blob?: Blob;
    filename?: string;
    mimeType?: string;
    size?: number;
    source?: string;
}

type ResolvedReferenceImage = {
    blob: Blob;
    filename: string;
    mimeType: string;
    size: number;
    source: string;
};

interface OpenAIResponsesResponse {
    id?: string;
    status?: string;
    output?: unknown[];
}

const MAX_REFERENCE_IMAGE_BYTES = 50 * 1024 * 1024;

export class OpenAIImageClient {
    private readonly apiKey: string;
    private readonly baseURL: string;

    constructor(config: OpenAIImageClientConfig) {
        if (!config.apiKey) {
            throw HttpErrorFactory.badRequest("图片模型接入点绑定的主站密钥缺少 apiKey/api_key 字段");
        }
        this.apiKey = config.apiKey;
        this.baseURL = normalizeImageBaseURL(config.baseURL || DEFAULT_IMAGE_GATEWAY_BASE_URL);
    }

    async testConnection(model: string, requestContract: ImageRequestContract = "responses") {
        await this.generate({
            model,
            prompt: "A simple gray square on a white background",
            size: "1024x1024",
            quality: "standard",
            outputFormat: "png",
            requestContract,
        });
    }

    async generate(options: GenerateOpenAIImageOptions) {
        if (options.requestContract === "images" || options.requestContract === "openai-compatible-images") {
            return this.generateImages(options);
        }
        if (options.requestContract === "provider-native") {
            throw HttpErrorFactory.badRequest("该图像模型的原生协议尚未接入");
        }
        const references = await this.resolveReferenceImages(options.referenceImages ?? [], options.maxReferenceImageBytes);
        const inputContent: Array<Record<string, unknown>> = [
            { type: "input_text", text: options.prompt },
        ];

        for (const reference of references) {
            inputContent.push({
                type: "input_image",
                image_url: await this.referenceToDataUrl(reference),
            });
        }

        const body = buildDefinedWhere<Record<string, unknown>>({
            model: options.model,
            input: [
                {
                    role: "user",
                    content: inputContent,
                },
            ],
            tools: [
                buildDefinedWhere<Record<string, unknown>>({
                    type: "image_generation",
                    size: options.size,
                    quality: options.quality,
                    output_format: options.outputFormat,
                    background: options.background,
                    output_compression: options.outputCompression,
                    input_fidelity: options.inputFidelity,
                    moderation: options.moderation,
                    seed: options.seed,
                }),
            ],
        });

        return this.executeResponsesRequest(body);
    }

    private async generateImages(options: GenerateOpenAIImageOptions) {
        const references = await this.resolveReferenceImages(options.referenceImages ?? [], options.maxReferenceImageBytes);
        const mask = options.maskImage
            ? await this.resolveAuxiliaryImage(options.maskImage, options.maxReferenceImageBytes ?? MAX_REFERENCE_IMAGE_BYTES)
            : undefined;

        if (mask && !references.length) {
            throw HttpErrorFactory.badRequest("局部重绘需要同时提供参考图和遮罩图");
        }
        if (references.length || mask) {
            return this.generateImagesEdit(options, references, mask);
        }

        const body = buildDefinedWhere<Record<string, unknown>>({
            model: options.model,
            prompt: options.prompt,
            negative_prompt: options.negativePrompt,
            n: Math.max(1, Math.min(4, options.n ?? 1)),
            size: options.size,
            quality: options.quality,
            response_format: "b64_json",
            style: options.style,
            output_format: options.outputFormat,
            background: options.background,
            moderation: options.moderation,
            seed: options.seed,
        });

        return this.executeImagesRequest(body);
    }

    private async generateImagesEdit(
        options: GenerateOpenAIImageOptions,
        references: ResolvedReferenceImage[],
        mask?: ResolvedReferenceImage,
    ) {
        if (!references.length) {
            throw HttpErrorFactory.badRequest("图生图需要提供参考图");
        }

        const form = this.createImagesEditForm(options, references, mask);
        return this.executeImagesEditRequest(form);
    }

    private createImagesEditForm(
        options: GenerateOpenAIImageOptions,
        references: ResolvedReferenceImage[],
        mask?: ResolvedReferenceImage,
    ) {
        const form = new FormData();
        form.set("model", options.model);
        form.set("prompt", options.prompt);
        form.set("n", String(options.n ?? 1));
        if (options.size) form.set("size", options.size);
        if (options.quality) form.set("quality", options.quality);
        if (options.responseFormat) form.set("response_format", options.responseFormat);
        if (options.negativePrompt) form.set("negative_prompt", options.negativePrompt);
        if (options.outputFormat) form.set("output_format", options.outputFormat);
        if (options.background) form.set("background", options.background);
        if (options.moderation) form.set("moderation", options.moderation);
        if (options.seed !== undefined) form.set("seed", String(options.seed));
        if (mask) form.set("mask", mask.blob, mask.filename);

        references.forEach((reference) => {
            form.append("image", reference.blob, reference.filename);
        });

        return form;
    }

    private async executeResponsesRequest(body: Record<string, unknown>) {
        const responseText = await requestImageResponseText(`${this.baseURL}/responses`, {
            method: "POST",
            apiKey: this.apiKey,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const parsed = safeJsonParse<OpenAIResponsesResponse>(responseText);
        const images = extractResponsesImages(parsed);
        if (!images.length) {
            throw HttpErrorFactory.badRequest("Responses API 响应中没有图片数据");
        }

        return {
            images,
            rawResponse: {
                id: parsed?.id,
                status: parsed?.status,
                imageCount: images.length,
                apiMode: "responses",
            },
            rawRequest: body,
            baseURL: this.baseURL,
        };
    }

    private async executeImagesRequest(body: Record<string, unknown>) {
        const responseText = await requestImageResponseText(`${this.baseURL}/images/generations`, {
            method: "POST",
            apiKey: this.apiKey,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const parsed = safeJsonParse<{ data?: Array<Record<string, unknown>> }>(responseText);
        const images = extractImagesApiImages(parsed);
        if (!images.length) {
            throw HttpErrorFactory.badRequest("Images API 响应中没有图片数据");
        }

        return {
            images,
            rawResponse: {
                imageCount: images.length,
                apiMode: "images",
            },
            rawRequest: body,
            baseURL: this.baseURL,
        };
    }

    private async executeImagesEditRequest(body: FormData) {
        const responseText = await requestImageResponseText(`${this.baseURL}/images/edits`, {
            method: "POST",
            apiKey: this.apiKey,
            body,
        });

        const parsed = safeJsonParse<{ data?: Array<Record<string, unknown>> }>(responseText);
        const images = extractImagesApiImages(parsed);
        if (!images.length) {
            throw HttpErrorFactory.badRequest("Images Edit API 响应中没有图片数据");
        }

        return {
            images,
            rawResponse: {
                imageCount: images.length,
                apiMode: "images-edit",
            },
            rawRequest: {
                model: body.get("model"),
                prompt: body.get("prompt"),
                n: body.get("n"),
                size: body.get("size"),
                quality: body.get("quality"),
                responseFormat: body.get("response_format"),
                hasMask: Boolean(body.get("mask")),
            },
            baseURL: this.baseURL,
        };
    }

    private async resolveReferenceImages(images: ReferenceImageInput[], maxBytes = MAX_REFERENCE_IMAGE_BYTES) {
        const uniqueImages = dedupeReferenceImages(images);
        return Promise.all(uniqueImages.map((image) => this.resolveAuxiliaryImage(image, maxBytes)));
    }

    private resolveProvidedImage(image: ReferenceImageInput) {
        if (!image.blob) {
            throw HttpErrorFactory.badRequest("图像文件不存在或无法读取");
        }
        const mimeType = normalizeImageMimeType(image.mimeType ?? image.blob.type, image.filename ?? "reference.png");
        return {
            blob: image.blob,
            filename: image.filename || buildImageFilename("reference.png", mimeType),
            mimeType,
            size: image.size ?? image.blob.size,
            source: image.source || "file",
        };
    }

    private async resolveAuxiliaryImage(image: ReferenceImageInput, maxBytes: number) {
        if (image.blob) return this.resolveProvidedImage(image);
        if (image.url) return downloadReferenceImageFromUrl(image.url, maxBytes);
        throw HttpErrorFactory.badRequest("图像文件不存在或无法读取");
    }

    private async referenceToDataUrl(reference: ResolvedReferenceImage) {
        const arrayBuffer = await reference.blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return `data:${reference.mimeType};base64,${base64}`;
    }
}

function dedupeReferenceImages(images: ReferenceImageInput[]) {
    const seen = new Set<string>();
    return images.filter((image) => {
        const key = image.source || image.url || image.filename || `${image.mimeType}:${image.size}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractResponsesImages(response: OpenAIResponsesResponse | undefined): GeneratedImageRecord[] {
    const images: GeneratedImageRecord[] = [];
    const walk = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }

        const item = value as Record<string, unknown>;
        const type = typeof item.type === "string" ? item.type : "";
        const result = typeof item.result === "string" ? item.result : undefined;
        const b64Json = typeof item.b64_json === "string" ? item.b64_json : undefined;
        const url = typeof item.url === "string" ? item.url : undefined;
        if ((type === "image_generation_call" || type.includes("image")) && (result || b64Json || url)) {
            images.push({
                url,
                b64Json: result || b64Json,
                mimeType: result || b64Json ? "image/png" : undefined,
            });
            return;
        }

        Object.values(item).forEach(walk);
    };
    walk(response?.output);
    return images;
}

function extractImagesApiImages(response: { data?: Array<Record<string, unknown>> } | undefined): GeneratedImageRecord[] {
    return (response?.data ?? [])
        .map((item) => ({
            url: typeof item.url === "string" ? item.url : undefined,
            b64Json: typeof item.b64_json === "string" ? item.b64_json : undefined,
            revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
            mimeType: typeof item.b64_json === "string" ? "image/png" : undefined,
        }))
        .filter((item) => item.url || item.b64Json);
}
