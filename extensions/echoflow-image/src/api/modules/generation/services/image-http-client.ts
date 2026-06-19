import { HttpErrorFactory } from "@buildingai/errors";
import { normalizePublicHttpUrl } from "@buildingai/extension-sdk";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

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

interface PublicHttpUrl {
    url: URL;
    address: string;
    family: 4 | 6;
}

interface DownloadedHttpResponse {
    url: URL;
    status: number;
    ok: boolean;
    headers: Record<string, string>;
    buffer: Buffer;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const MAX_REFERENCE_REDIRECTS = 3;

class RetryableImageHttpError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RetryableImageHttpError";
    }
}

export async function requestImageResponseText(url: string, options: ImageRequestOptions): Promise<string> {
    let lastError: Error | undefined;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await executeImageRequest(url, options, attempt);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (!(lastError instanceof RetryableImageHttpError) || attempt >= maxRetries) {
                throw lastError;
            }
            await sleep(Math.pow(2, attempt * 2) * 1_000);
        }
    }

    throw lastError ?? new Error("图像生成请求失败");
}

export function normalizeImageBaseURL(raw: string): string {
    return normalizePublicHttpUrl(raw, { label: "图片模型 Base URL" });
}

export async function downloadReferenceImageFromUrl(url: string, maxBytes: number): Promise<DownloadedReferenceImage> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
        let currentUrl = url;
        let response: DownloadedHttpResponse | undefined;

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
            blob: new Blob([toArrayBuffer(response.buffer)], { type: mimeType }),
            filename: buildImageFilename(response.url.toString(), mimeType),
            mimeType,
            size: response.buffer.byteLength,
            source: summarizeUrl(response.url.toString()),
        };
    } catch (error) {
        if (isAbortError(error)) {
            throw HttpErrorFactory.badRequest("参考图下载超时");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
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

export function safeJsonParse<T>(value: string): T | undefined {
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

async function executeImageRequest(url: string, options: ImageRequestOptions, attempt: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                Authorization: options.apiKey.includes("Bearer ") ? options.apiKey : `Bearer ${options.apiKey}`,
                ...options.headers,
            },
            body: options.body,
            signal: controller.signal,
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw classifyImageHttpError(response.status, attempt, responseText);
        }

        return responseText;
    } catch (error) {
        if (isAbortError(error)) {
            throw new RetryableImageHttpError("图像生成请求超时");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
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

async function downloadPublicHttpUrl(raw: string, maxBytes: number, signal: AbortSignal): Promise<DownloadedHttpResponse> {
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
                        ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
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

function classifyImageHttpError(status: number, attempt: number, responseText?: string): Error {
    const prefix = attempt > 0 ? `(重试 ${attempt} 次后) ` : "";
    const detail = extractErrorMessage(responseText);
    const suffix = detail ? `：${detail}` : "";
    switch (status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}请求参数有误，请检查模型、尺寸、质量和提示词${suffix}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无效或已过期，请检查模型接入点`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无权限访问该模型`);
        case 429:
            return new RetryableImageHttpError(`${prefix}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return new RetryableImageHttpError(`${prefix}图片服务暂时不可用 (${status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}图像生成请求失败，服务返回状态码 ${status}${suffix}`);
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

function extractErrorMessage(responseText?: string) {
    if (!responseText) return "";
    const parsed = safeJsonParse<{ error?: { message?: string }; message?: string }>(responseText);
    const message = parsed?.error?.message || parsed?.message;
    return message ? message.slice(0, 300) : "";
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
