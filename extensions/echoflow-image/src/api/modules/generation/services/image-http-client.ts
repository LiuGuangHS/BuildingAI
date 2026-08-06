import { HttpErrorFactory } from "@buildingai/errors";
import {
    downloadPublicHttpUrl,
    normalizeProviderBaseUrl,
    requestProviderText,
    type ProviderHttpErrorContext,
} from "@buildingai/extension-sdk";

export type ImageRequestBody = string | FormData;

export interface ImageRequestOptions {
    method: string;
    apiKey: string;
    body?: ImageRequestBody;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface DownloadedReferenceImage {
    blob: Blob;
    filename: string;
    mimeType: string;
    size: number;
    source: string;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const MAX_REFERENCE_REDIRECTS = 3;

export async function requestImageResponseText(url: string, options: ImageRequestOptions): Promise<string> {
    return requestProviderText(url, {
        method: options.method,
        body: options.body,
        headers: {
            Authorization: options.apiKey.includes("Bearer ") ? options.apiKey : `Bearer ${options.apiKey}`,
            ...options.headers,
        },
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: options.maxRetries ?? MAX_RETRIES,
        retryDelayMs: 1_000,
        serviceLabel: "图片服务",
        badRequestLabel: "请求参数有误，请检查模型、尺寸、质量和提示词",
        classifyError: classifyImageHttpError,
    });
}

export function normalizeImageBaseURL(raw: string): string {
    return normalizeProviderBaseUrl(raw, "图片模型 Base URL");
}

export async function downloadReferenceImageFromUrl(url: string, maxBytes: number): Promise<DownloadedReferenceImage> {
    const response = await downloadPublicHttpUrl(url, {
        label: "参考图",
        urlLabel: "参考图地址",
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
        maxBytes,
        maxRedirects: MAX_REFERENCE_REDIRECTS,
    });
    if (!response.ok) {
        throw HttpErrorFactory.badRequest(`参考图下载失败，状态码 ${response.status}`);
    }

    const mimeType = normalizeImageMimeType(response.headers["content-type"], response.url.toString());
    const contentLength = Number(response.headers["content-length"] || 0);
    if (contentLength > maxBytes) {
        throw HttpErrorFactory.badRequest(`参考图不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
    }

    return {
        blob: new Blob([toArrayBuffer(response.buffer)], { type: mimeType }),
        filename: buildImageFilename(response.url.toString(), mimeType),
        mimeType,
        size: response.buffer.byteLength,
        source: summarizeUrl(response.url.toString()),
    };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export function normalizeImageMimeType(raw: string | null | undefined, url: string) {
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

function classifyImageHttpError(context: ProviderHttpErrorContext): Error {
    const prefix = context.attempt > 0 ? `(重试 ${context.attempt} 次后) ` : "";
    switch (context.status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}请求参数有误，请检查模型、尺寸、质量和提示词`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无效或已过期，请检查模型接入点`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无权限访问该模型`);
        case 429:
            return HttpErrorFactory.badRequest(`${prefix}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return HttpErrorFactory.badRequest(`${prefix}图片服务暂时不可用 (${context.status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}图像生成请求失败，服务返回状态码 ${context.status}`);
    }
}

export function buildImageFilename(url: string, mimeType: string) {
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

function summarizeUrl(raw: string) {
    try {
        const url = new URL(raw);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return "";
    }
}
