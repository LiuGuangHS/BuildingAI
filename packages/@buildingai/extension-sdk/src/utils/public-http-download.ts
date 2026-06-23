import { HttpErrorFactory } from "@buildingai/errors";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";

import { resolvePublicHttpUrl } from "./public-http-url";

export interface PublicHttpDownloadOptions {
    label?: string;
    urlLabel?: string;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
}

export interface PublicHttpDownloadResult {
    url: URL;
    status: number;
    ok: boolean;
    headers: Record<string, string>;
    buffer: Buffer;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function downloadPublicHttpUrl(
    raw: string,
    options: PublicHttpDownloadOptions = {},
): Promise<PublicHttpDownloadResult> {
    const label = options.label ?? "文件";
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
        let currentUrl = raw;
        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
            const response = await downloadResolvedPublicHttpUrl(currentUrl, {
                label,
                urlLabel: options.urlLabel,
                maxBytes,
                signal: controller.signal,
            });
            if (!REDIRECT_STATUSES.has(response.status)) {
                return response;
            }
            const location = response.headers.location;
            if (!location) {
                throw HttpErrorFactory.badRequest(`${label}重定向地址无效`);
            }
            currentUrl = new URL(location, response.url).toString();
        }
        throw HttpErrorFactory.badRequest(`${label}重定向次数过多`);
    } catch (error) {
        if (isAbortError(error)) {
            throw HttpErrorFactory.badRequest(`${label}下载超时`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function downloadResolvedPublicHttpUrl(
    raw: string,
    options: {
        label: string;
        urlLabel?: string;
        maxBytes: number;
        signal: AbortSignal;
    },
): Promise<PublicHttpDownloadResult> {
    const safe = await resolvePublicHttpUrl(raw, { label: options.urlLabel ?? `${options.label}地址` });
    const requestImpl = safe.url.protocol === "https:" ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
        const req = requestImpl(
            safe.url,
            {
                method: "GET",
                lookup: (_hostname, _lookupOptions, callback) => {
                    callback(null, safe.address, safe.family);
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                let total = 0;

                res.on("data", (chunk: Buffer) => {
                    total += chunk.byteLength;
                    if (total > options.maxBytes) {
                        req.destroy(
                            HttpErrorFactory.badRequest(
                                `${options.label}不能超过 ${Math.floor(options.maxBytes / 1024 / 1024)}MB`,
                            ),
                        );
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
        options.signal.addEventListener("abort", abort, { once: true });
        req.on("error", reject);
        req.on("close", () => options.signal.removeEventListener("abort", abort));
        req.end();
    });
}

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) {
            continue;
        }
        const firstValue = Array.isArray(value) ? value[0] : value;
        normalized[key.toLowerCase()] = String(firstValue);
    }
    return normalized;
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}
