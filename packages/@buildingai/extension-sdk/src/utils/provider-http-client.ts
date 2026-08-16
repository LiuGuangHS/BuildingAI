import { HttpErrorFactory } from "@buildingai/errors";

import { safeJsonParse } from "./json";
import { assertPublicHttpUrl, normalizePublicHttpUrl } from "./public-http-url";

export { safeJsonParse } from "./json";

export interface ProviderHttpRequestOptions {
    method: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    idempotencyKey?: string;
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

const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
const MAX_PROVIDER_RETRIES = 2;
const AUTHENTICATION_FAILURE = Symbol("providerAuthenticationFailure");

type AuthenticationFailure = Error & { [AUTHENTICATION_FAILURE]?: true };

export class ProviderHttpError extends Error {
    readonly retryable: boolean;
    readonly authenticationFailure: boolean;

    constructor(message: string, retryable = false, authenticationFailure = false) {
        super(message);
        this.name = "ProviderHttpError";
        this.retryable = retryable;
        this.authenticationFailure = authenticationFailure;
    }
}

export async function requestProviderText(url: string, options: ProviderHttpRequestOptions): Promise<string> {
    assertNoConflictingIdempotencyKey(options);
    const safeUrl = await assertPublicHttpUrl(url, { label: options.serviceLabel ?? "Provider URL" });
    let lastError: Error | undefined;
    const maxRetries = canRetryProviderRequest(options)
        ? Math.min(normalizeMaxRetries(options.maxRetries), MAX_PROVIDER_RETRIES)
        : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await executeProviderTextRequest(safeUrl, options, attempt);
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
    const safeUrl = await assertPublicHttpUrl(url, { label: options.serviceLabel ?? "Provider URL" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

    try {
        const response = await fetch(safeUrl, {
            method: options.method,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                ...options.headers,
            },
            signal: controller.signal,
            redirect: "error",
        });

        if (response.status === 404) return;
        if (!response.ok) {
            throw classifyProviderHttpError({
                status: response.status,
                body: await readProviderResponse(response),
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
                ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
            },
            body: options.body,
            signal: controller.signal,
            redirect: "error",
        });
        const responseText = await readProviderResponse(response);
        if (!response.ok) {
            const context = {
                status: response.status,
                body: responseText,
                attempt,
                serviceLabel: options.serviceLabel ?? "Provider",
                badRequestLabel: options.badRequestLabel ?? "Provider 请求参数有误",
            };
            if (response.status === 401 || response.status === 403) {
                const error = classifyProviderHttpError(context) as AuthenticationFailure;
                error[AUTHENTICATION_FAILURE] = true;
                throw error;
            }
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

async function readProviderResponse(response: Response): Promise<string> {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
        throw new ProviderHttpError("Provider 响应过大", false);
    }

    if (!response.body) return "";

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) {
                throw new ProviderHttpError("Provider 响应过大", false);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
}

function classifyProviderHttpError(context: ProviderHttpErrorContext): Error {
    const prefix = context.attempt > 0 ? `(重试 ${context.attempt} 次后) ` : "";

    switch (context.status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}${context.badRequestLabel}`);
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
            return HttpErrorFactory.badRequest(`${prefix}${context.serviceLabel}请求失败: ${context.status}`);
    }
}

function normalizeMaxRetries(value: number | undefined): number {
    if (value === undefined) return MAX_PROVIDER_RETRIES;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function assertNoConflictingIdempotencyKey(options: ProviderHttpRequestOptions): void {
    if (!options.idempotencyKey) return;

    const headers = [options.defaultHeaders, options.headers].filter(Boolean) as Record<string, string>[];
    if (headers.some((entry) => Object.keys(entry).some((name) => name.toLowerCase() === "idempotency-key"))) {
        throw HttpErrorFactory.badRequest("Provider 请求的幂等键重复定义");
    }
}

function canRetryProviderRequest(options: ProviderHttpRequestOptions): boolean {
    return ["GET", "HEAD", "OPTIONS"].includes(options.method.toUpperCase()) || Boolean(options.idempotencyKey);
}

function isRetryableProviderError(error: Error, options: ProviderHttpRequestOptions): boolean {
    if ((error as AuthenticationFailure)[AUTHENTICATION_FAILURE]) return false;
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
