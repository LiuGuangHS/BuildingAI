import { HttpErrorFactory } from "@buildingai/errors";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import { ImageResponseFormat, type GeneratedImageRecord } from "../../../db/entities/image-generation.entity";

export interface OpenAIImageClientConfig {
    apiKey?: string;
    baseURL?: string;
}

export interface GenerateOpenAIImageOptions {
    model: string;
    prompt: string;
    n: number;
    size: string;
    quality?: string;
    style?: string;
    responseFormat: ImageResponseFormat;
    referenceImageUrl?: string;
    referenceImage?: ReferenceImageInput;
    referenceImages?: ReferenceImageInput[];
    maskImage?: ReferenceImageInput;
    maxReferenceImageBytes?: number;
    apiMode?: "images" | "responses";
    seed?: string;
    outputFormat?: string;
    background?: string;
    outputCompression?: number;
    inputFidelity?: string;
    moderation?: string;
    requestPolicy?: string;
}

export interface ReferenceImageInput {
    url?: string;
    blob?: Blob;
    filename?: string;
    mimeType?: string;
    size?: number;
    source?: string;
}

interface OpenAIImageResponseItem {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
}

interface OpenAIImageResponse {
    created?: number;
    data?: OpenAIImageResponseItem[];
}

interface OpenAIResponsesResponse {
    id?: string;
    status?: string;
    output?: unknown[];
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const MAX_REFERENCE_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_REFERENCE_REDIRECTS = 3;

/** Error thrown for transient failures that should be retried. */
class RetryableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RetryableError";
    }
}

export class OpenAIImageClient {
    private readonly apiKey: string;
    private readonly baseURL: string;

    constructor(config: OpenAIImageClientConfig) {
        if (!config.apiKey) {
            throw HttpErrorFactory.badRequest("图片模型未配置 API Key");
        }

        this.apiKey = config.apiKey;
        this.baseURL = normalizeBaseURL(config.baseURL || "https://api.openai.com/v1");
    }

    async generate(options: GenerateOpenAIImageOptions) {
        if (options.apiMode === "responses") {
            return this.generateWithResponses(options);
        }

        if (options.referenceImageUrl || options.referenceImage || options.referenceImages?.length) {
            return this.edit(options);
        }

        const body = removeUndefined({
            model: options.model,
            prompt: options.prompt,
            n: options.n,
            size: options.size,
            quality: options.quality,
            style: options.style,
            response_format: options.responseFormat,
            seed: options.requestPolicy === "compat" ? options.seed : undefined,
            output_format: options.outputFormat,
            background: options.background,
            output_compression: options.outputCompression,
            input_fidelity: options.inputFidelity,
            moderation: options.moderation,
        });

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.executeRequest(body, attempt);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (!(lastError instanceof RetryableError)) {
                    throw lastError;
                }

                if (attempt < MAX_RETRIES) {
                    const delay = Math.pow(2, attempt * 2) * 1000;
                    await sleep(delay);
                }
            }
        }

        throw lastError ?? new Error("图像生成请求失败");
    }

    async enhancePrompt(input: { model: string; prompt: string; style?: string }) {
        const body = {
            model: input.model,
            temperature: 0.4,
            messages: [
                {
                    role: "system",
                    content: "You rewrite image prompts. Return one concise Chinese image prompt only. Preserve the user's intent. Add composition, lighting, detail, and style cues. Do not add policy-unsafe content.",
                },
                {
                    role: "user",
                    content: `原始提示词：${input.prompt}\n偏好风格：${input.style || "auto"}`,
                },
            ],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: this.apiKey.includes("Bearer ") ? this.apiKey : `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const responseText = await response.text();
            if (!response.ok) {
                throw classifyHttpError(response.status, 0, responseText);
            }
            const parsed = safeJsonParse<{ choices?: Array<{ message?: { content?: string } }> }>(responseText);
            const text = parsed?.choices?.[0]?.message?.content?.trim();
            if (!text) {
                throw HttpErrorFactory.badRequest("Prompt 改写响应为空");
            }
            return text.slice(0, 4000);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async edit(options: GenerateOpenAIImageOptions) {
        if (!options.referenceImageUrl && !options.referenceImage && !options.referenceImages?.length) {
            throw HttpErrorFactory.badRequest("图生图需要提供参考图");
        }

        const references = await this.resolveReferenceImages(options);
        const [reference] = references;
        const mask = options.maskImage ? await this.resolveAuxiliaryImage(options.maskImage, options.maxReferenceImageBytes) : undefined;
        const formData = new FormData();
        formData.append("model", options.model);
        formData.append("prompt", options.prompt);
        references.forEach((item, index) => {
            formData.append(references.length > 1 && options.requestPolicy !== "compat" ? "image[]" : "image", item.blob, item.filename || `reference-${index + 1}.png`);
        });
        if (mask) {
            formData.append("mask", mask.blob, mask.filename);
        }
        appendFormValue(formData, "n", options.n);
        appendFormValue(formData, "size", options.size);
        appendFormValue(formData, "quality", options.quality);
        appendFormValue(formData, "output_format", options.outputFormat);
        appendFormValue(formData, "background", options.background);
        appendFormValue(formData, "output_compression", options.outputCompression);
        appendFormValue(formData, "input_fidelity", options.inputFidelity);
        appendFormValue(formData, "moderation", options.moderation);

        if (options.requestPolicy === "compat" || isDalleModel(options.model)) {
            appendFormValue(formData, "response_format", options.responseFormat);
        }

        const rawRequest = removeUndefined({
            model: options.model,
            prompt: options.prompt,
            image: {
                filename: reference.filename,
                mimeType: reference.mimeType,
                size: reference.size,
                source: reference.source,
            },
            images: references.length > 1
                ? references.map((item) => ({
                    filename: item.filename,
                    mimeType: item.mimeType,
                    size: item.size,
                    source: item.source,
                }))
                : undefined,
            mask: mask
                ? {
                    filename: mask.filename,
                    mimeType: mask.mimeType,
                    size: mask.size,
                    source: mask.source,
                }
                : undefined,
            n: options.n,
            size: options.size,
            quality: options.quality,
            output_format: options.outputFormat,
            background: options.background,
            output_compression: options.outputCompression,
            input_fidelity: options.inputFidelity,
            moderation: options.moderation,
            response_format: options.requestPolicy === "compat" || isDalleModel(options.model) ? options.responseFormat : undefined,
        });

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.executeRequest({
                    endpoint: "/images/edits",
                    body: formData,
                    attempt,
                    rawRequest,
                });
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (!(lastError instanceof RetryableError)) {
                    throw lastError;
                }

                if (attempt < MAX_RETRIES) {
                    const delay = Math.pow(2, attempt * 2) * 1000;
                    await sleep(delay);
                }
            }
        }

        throw lastError ?? new Error("图像编辑请求失败");
    }

    private async generateWithResponses(options: GenerateOpenAIImageOptions) {
        const references = await this.resolveReferenceImages(options);
        const inputContent: Array<Record<string, unknown>> = [
            { type: "input_text", text: options.prompt },
        ];

        for (const reference of references) {
            inputContent.push({
                type: "input_image",
                image_url: await this.referenceToDataUrl(reference),
            });
        }

        const body = removeUndefined({
            model: options.model,
            input: [
                {
                    role: "user",
                    content: inputContent,
                },
            ],
            tools: [
                removeUndefined({
                    type: "image_generation",
                    size: options.size,
                    quality: options.quality,
                    output_format: options.outputFormat,
                    background: options.background,
                    moderation: options.moderation,
                }),
            ],
        });

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.executeResponsesRequest(body, attempt);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (!(lastError instanceof RetryableError)) {
                    throw lastError;
                }

                if (attempt < MAX_RETRIES) {
                    const delay = Math.pow(2, attempt * 2) * 1000;
                    await sleep(delay);
                }
            }
        }

        throw lastError ?? new Error("图像生成请求失败");
    }

    private async executeRequest(
        input:
            | { body: Record<string, unknown>; attempt: number; endpoint?: string; rawRequest?: Record<string, unknown> }
            | { body: FormData; attempt: number; endpoint: string; rawRequest: Record<string, unknown> },
    ) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
            const isFormData = input.body instanceof FormData;
            const response = await fetch(`${this.baseURL}${input.endpoint ?? "/images/generations"}`, {
                method: "POST",
                headers: {
                    ...(isFormData ? {} : { "Content-Type": "application/json" }),
                    Authorization: this.apiKey.includes("Bearer ") ? this.apiKey : `Bearer ${this.apiKey}`,
                },
                body: isFormData ? input.body : JSON.stringify(input.body),
                signal: controller.signal,
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw classifyHttpError(response.status, input.attempt, responseText);
            }

            const parsed = safeJsonParse<OpenAIImageResponse>(responseText);

            if (!parsed?.data || !Array.isArray(parsed.data) || parsed.data.length === 0) {
                throw HttpErrorFactory.badRequest("图像生成响应中没有图片数据");
            }

            const images: GeneratedImageRecord[] = parsed.data.map((item) => ({
                url: item.url,
                b64Json: item.b64_json,
                mimeType: item.b64_json ? "image/png" : undefined,
                revisedPrompt: item.revised_prompt,
            }));

            return {
                images,
                rawResponse: {
                    created: parsed.created,
                    imageCount: images.length,
                    responseFormat: isFormData ? undefined : input.body.response_format,
                },
                rawRequest: input.rawRequest ?? input.body,
                baseURL: this.baseURL,
            };
        } catch (error) {
            // AbortError from timeout → retryable
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new RetryableError("图像生成请求超时");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async executeResponsesRequest(body: Record<string, unknown>, attempt: number) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
            const response = await fetch(`${this.baseURL}/responses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: this.apiKey.includes("Bearer ") ? this.apiKey : `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            const responseText = await response.text();
            if (!response.ok) {
                throw classifyHttpError(response.status, attempt, responseText);
            }

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
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new RetryableError("图像生成请求超时");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async resolveReferenceImages(options: GenerateOpenAIImageOptions) {
        const images = [
            ...(options.referenceImages ?? []),
            ...(options.referenceImage ? [options.referenceImage] : []),
            ...(options.referenceImageUrl ? [{ url: options.referenceImageUrl, source: options.referenceImageUrl }] : []),
        ];

        const uniqueImages = dedupeReferenceImages(images);
        if (!uniqueImages.length) {
            if (options.referenceImageUrl || options.referenceImage || options.referenceImages?.length) {
                throw HttpErrorFactory.badRequest("图生图需要提供参考图");
            }
            return [];
        }

        return Promise.all(uniqueImages.map((image) => this.resolveAuxiliaryImage(image, options.maxReferenceImageBytes)));
    }

    private async resolveReferenceImage(options: GenerateOpenAIImageOptions) {
        if (options.referenceImage?.blob) {
            return this.resolveProvidedImage(options.referenceImage);
        }

        const url = options.referenceImage?.url || options.referenceImageUrl;
        if (!url) {
            throw HttpErrorFactory.badRequest("图生图需要提供参考图");
        }

        return this.downloadReferenceImage(url, options.maxReferenceImageBytes);
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

    private async resolveAuxiliaryImage(image: ReferenceImageInput, maxBytes?: number) {
        if (image.blob) return this.resolveProvidedImage(image);
        if (image.url) return this.downloadReferenceImage(image.url, maxBytes);
        throw HttpErrorFactory.badRequest("图像文件不存在或无法读取");
    }

    private async referenceToDataUrl(reference: ReturnType<OpenAIImageClient["resolveProvidedImage"]>) {
        const arrayBuffer = await reference.blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return `data:${reference.mimeType};base64,${base64}`;
    }

    private async downloadReferenceImage(url: string, maxBytes = MAX_REFERENCE_IMAGE_BYTES) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

        try {
            let currentUrl = url;
            let response: DownloadedImageResponse | undefined;

            for (let redirectCount = 0; redirectCount <= MAX_REFERENCE_REDIRECTS; redirectCount++) {
                response = await downloadPublicHttpUrl(currentUrl, maxBytes, controller.signal);

                if (![301, 302, 303, 307, 308].includes(response.status)) {
                    break;
                }

                const location = response.headers.location;
                if (!location) {
                    throw HttpErrorFactory.badRequest("参考图重定向地址无效");
                }
                currentUrl = new URL(location, response.url).toString();
                response = undefined;
            }

            if (!response) {
                throw HttpErrorFactory.badRequest("参考图重定向次数过多");
            }

            if (!response.ok) {
                throw HttpErrorFactory.badRequest(`参考图下载失败，状态码 ${response.status}`);
            }

            const mimeType = normalizeImageMimeType(response.headers["content-type"], response.url.toString());
            const contentLength = Number(response.headers["content-length"] || 0);
            if (contentLength > maxBytes) {
                throw HttpErrorFactory.badRequest(`参考图不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
            }

            return {
                blob: new Blob([response.buffer], { type: mimeType }),
                filename: buildImageFilename(response.url.toString(), mimeType),
                mimeType,
                size: response.buffer.byteLength,
                source: summarizeUrl(response.url.toString()),
            };
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw HttpErrorFactory.badRequest("参考图下载超时");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

interface PublicHttpUrl {
    url: URL;
    address: string;
    family: 4 | 6;
}

interface DownloadedImageResponse {
    url: URL;
    status: number;
    headers: Record<string, string>;
    buffer: Buffer;
}

async function assertPublicHttpUrl(raw: string): Promise<PublicHttpUrl> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw HttpErrorFactory.badRequest("图生图参考图地址无效");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw HttpErrorFactory.badRequest("图生图参考图需要是可由服务端访问的 http(s) 地址");
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest("参考图地址不能包含认证信息");
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw HttpErrorFactory.badRequest("参考图地址不能指向本机或内网主机");
    }

    const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
        : await dnsLookup(hostname, { all: true, verbatim: true }).catch(() => {
            throw HttpErrorFactory.badRequest("参考图地址无法解析");
        });

    if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
        throw HttpErrorFactory.badRequest("参考图地址不能指向本机、内网或保留网段");
    }

    return {
        url,
        address: addresses[0].address,
        family: addresses[0].family as 4 | 6,
    };
}

async function downloadPublicHttpUrl(raw: string, maxBytes: number, signal: AbortSignal): Promise<DownloadedImageResponse> {
    const safe = await assertPublicHttpUrl(raw);
    const requestImpl = safe.url.protocol === "https:" ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
        const req = requestImpl(
            safe.url,
            {
                method: "GET",
                lookup: (_hostname, _options, callback) => {
                    callback(null, safe.address, safe.family);
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                let total = 0;

                res.on("data", (chunk: Buffer) => {
                    total += chunk.byteLength;
                    if (total > maxBytes) {
                        req.destroy(HttpErrorFactory.badRequest(`参考图不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on("end", () => {
                    resolve({
                        url: safe.url,
                        status: res.statusCode ?? 0,
                        headers: normalizeHeaders(res.headers),
                        buffer: Buffer.concat(chunks),
                    });
                });
            },
        );

        const abort = () => req.destroy(new DOMException("Aborted", "AbortError"));
        signal.addEventListener("abort", abort, { once: true });
        req.on("error", reject);
        req.on("close", () => signal.removeEventListener("abort", abort));
        req.end();
    });
}

function normalizeHeaders(headers: Record<string, string | string[] | number | undefined>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : String(value)]),
    );
}

function isPrivateOrReservedIp(address: string): boolean {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrReservedIpv4(mapped[1]);

    if (isIP(normalized) === 4) {
        return isPrivateOrReservedIpv4(normalized);
    }

    if (isIP(normalized) === 6) {
        return (
            normalized === "::" ||
            normalized === "::1" ||
            normalized.startsWith("fc") ||
            normalized.startsWith("fd") ||
            normalized.startsWith("fe80:") ||
            normalized.startsWith("ff") ||
            normalized.startsWith("2001:db8:")
        );
    }

    return true;
}

function isPrivateOrReservedIpv4(address: string): boolean {
    const parts = address.split(".").map((item) => Number(item));
    if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
        return true;
    }
    const [a, b] = parts;

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51) ||
        (a === 203 && b === 0) ||
        a >= 224
    );
}

function classifyHttpError(status: number, attempt: number, responseText?: string): Error {
    const prefix = attempt > 0 ? `(重试 ${attempt} 次后) ` : "";
    const detail = extractErrorMessage(responseText);
    const suffix = detail ? `：${detail}` : "";

    switch (status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}请求参数有误，请检查模型、尺寸、质量和提示词${suffix}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无效或已过期，请检查模型配置`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}API Key 无权限访问该模型`);
        case 429:
            return new RetryableError(`${prefix}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return new RetryableError(`${prefix}图片服务暂时不可用 (${status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}图像生成请求失败，服务返回状态码 ${status}${suffix}`);
    }
}

function normalizeBaseURL(raw: string): string {
    try {
        const trimmed = raw.trim().replace(/\/+$/, "");
        if (!trimmed) {
            throw new Error("empty baseURL");
        }
        const url = new URL(trimmed);
        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("unsupported protocol");
        }
        if (url.username || url.password) {
            throw new Error("credentials not allowed");
        }
        return trimmed;
    } catch {
        throw HttpErrorFactory.badRequest("图片模型 baseURL 配置无效");
    }
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function appendFormValue(formData: FormData, key: string, value: unknown) {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, String(value));
}

function isDalleModel(model: string) {
    return model.toLowerCase().startsWith("dall-e");
}

function normalizeImageMimeType(raw: string | null | undefined, url: string) {
    const mimeType = raw?.split(";")[0]?.trim().toLowerCase();
    if (mimeType && ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) {
        return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
    }

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes(".png")) return "image/png";
    if (lowerUrl.includes(".webp")) return "image/webp";
    if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) return "image/jpeg";
    throw HttpErrorFactory.badRequest("参考图格式仅支持 png、jpg、webp");
}

function buildImageFilename(url: string, mimeType: string) {
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    try {
        const pathname = new URL(url).pathname;
        const rawName = pathname.split("/").pop();
        if (rawName && /\.[a-z0-9]+$/i.test(rawName)) return rawName;
    } catch {
        // ignored
    }
    return `reference.${extension}`;
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

function summarizeUrl(raw: string) {
    try {
        const url = new URL(raw);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return "";
    }
}

function extractErrorMessage(responseText?: string) {
    if (!responseText) return "";
    const parsed = safeJsonParse<{ error?: { message?: string }; message?: string }>(responseText);
    const message = parsed?.error?.message || parsed?.message;
    return message ? message.slice(0, 300) : "";
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
