import { HttpErrorFactory } from "@buildingai/errors";

import { safeJsonParse } from "./json";
import { normalizePublicHttpUrl } from "./public-http-url";

export { safeJsonParse } from "./json";

export interface ProviderHttpRequestOptions {
    method: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    serviceLabel?: string;
    badRequestLabel?: string;
    defaultHeaders?: Record<string, string>;
    classifyError?: (context: ProviderHttpErrorContext) => Error;
    isRetryableError?: (error: Error) => boolean;
}

export interface ProviderHttpErrorContext {
    status: number;
    body: string;
    attempt: number;
    serviceLabel: string;
    badRequestLabel: string;
}

export class ProviderHttpError extends Error {
    readonly retryable: boolean;

    constructor(message: string, retryable = false) {
        super(message);
        this.name = "ProviderHttpError";
        this.retryable = retryable;
    }
}

export async function requestProviderText(url: string, options: ProviderHttpRequestOptions): Promise<string> {
    let lastError: Error | undefined;
    const maxRetries = options.maxRetries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await executeProviderTextRequest(url, options, attempt);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (!isRetryableProviderError(lastError, options) || attempt >= maxRetries) {
                throw lastError;
            }
            await sleep((options.retryDelayMs ?? 1_000) * Math.pow(2, attempt));
        }
    }

    throw lastError ?? new Error(`${options.serviceLabel ?? "Provider"}请求失败`);
}

export async function requestProviderJson(
    url: string,
    options: ProviderHttpRequestOptions,
): Promise<Record<string, unknown>> {
    const responseText = await requestProviderText(url, {
        defaultHeaders: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        ...options,
    });
    const parsed = safeJsonParse<Record<string, unknown>>(responseText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw HttpErrorFactory.badRequest(`${options.serviceLabel ?? "Provider"}返回了无效 JSON`);
    }
    return parsed;
}

export async function testProviderJsonEndpoint(
    url: string,
    options: Omit<ProviderHttpRequestOptions, "body" | "maxRetries" | "retryDelayMs">,
): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

    try {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                ...options.headers,
            },
            signal: controller.signal,
        });

        if (response.status === 404) return;
        if (!response.ok) {
            throw classifyProviderHttpError({
                status: response.status,
                body: await response.text(),
                attempt: 0,
                serviceLabel: options.serviceLabel ?? "Provider",
                badRequestLabel: options.badRequestLabel ?? "Provider 请求参数有误",
            });
        }
    } catch (error) {
        if (isAbortError(error)) {
            throw HttpErrorFactory.badRequest(`${options.serviceLabel ?? "Provider"}连接测试超时，请稍后重试`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function normalizeProviderBaseUrl(value: string, label = "Provider Base URL"): string {
    return normalizePublicHttpUrl(value, { label });
}

async function executeProviderTextRequest(
    url: string,
    options: ProviderHttpRequestOptions,
    attempt: number,
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);

    try {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                ...options.defaultHeaders,
                ...options.headers,
            },
            body: options.body,
            signal: controller.signal,
        });
        const responseText = await response.text();
        if (!response.ok) {
            const context = {
                status: response.status,
                body: responseText,
                attempt,
                serviceLabel: options.serviceLabel ?? "Provider",
                badRequestLabel: options.badRequestLabel ?? "Provider 请求参数有误",
            };
            throw options.classifyError?.(context) ?? classifyProviderHttpError(context);
        }
        return responseText;
    } catch (error) {
        if (isAbortError(error)) {
            throw new ProviderHttpError(`${options.serviceLabel ?? "Provider"}请求超时，请稍后重试`, true);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function classifyProviderHttpError(context: ProviderHttpErrorContext): Error {
    const prefix = context.attempt > 0 ? `(重试 ${context.attempt} 次后) ` : "";
    const truncated = context.body.length > 500 ? context.body.slice(0, 500) + "..." : context.body;

    switch (context.status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}${context.badRequestLabel}: ${truncated}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无效或已过期`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无权限访问该模型`);
        case 429:
            return new ProviderHttpError(`${prefix}${context.serviceLabel}请求过于频繁，请稍后重试`, true);
        case 500:
        case 502:
        case 503:
        case 504:
            return new ProviderHttpError(`${prefix}${context.serviceLabel}暂时不可用 (${context.status})，请稍后重试`, true);
        default:
            return HttpErrorFactory.badRequest(`${prefix}${context.serviceLabel}请求失败: ${context.status} ${truncated}`);
    }
}

function isRetryableProviderError(error: Error, options: ProviderHttpRequestOptions): boolean {
    if (error instanceof ProviderHttpError) return error.retryable;
    if (options.isRetryableError?.(error)) return true;
    const message = error.message || "";
    return (
        message.includes("429") ||
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504") ||
        message.includes("请求过于频繁") ||
        message.includes("timeout") ||
        message.includes("超时") ||
        message.includes("ETIMEDOUT") ||
        message.includes("ECONNRESET") ||
        message.includes("aborted")
    );
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
