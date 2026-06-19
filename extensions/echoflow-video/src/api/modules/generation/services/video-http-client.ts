import { HttpErrorFactory } from "@buildingai/errors";

export type VideoJsonRequestOptions = {
    method: string;
    body?: string;
    headers?: Record<string, string>;
};

export type VideoJsonRequestRetryOptions = {
    requestTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    serviceLabel?: string;
    badRequestLabel?: string;
};

export async function requestVideoJson(
    url: string,
    options: VideoJsonRequestOptions,
    retryOptions: VideoJsonRequestRetryOptions = {},
): Promise<Record<string, unknown>> {
    let lastError: Error | undefined;
    const maxRetries = retryOptions.maxRetries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await executeVideoJsonRequest(url, options, retryOptions, attempt);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (!isRetryableVideoHttpError(lastError) || attempt >= maxRetries) {
                throw lastError;
            }
            await sleep((retryOptions.retryDelayMs ?? 1_000) * Math.pow(2, attempt));
        }
    }

    throw lastError ?? new Error(`${retryOptions.serviceLabel ?? "视频接口"}请求失败`);
}

export async function testVideoJsonEndpoint(
    url: string,
    options: Omit<VideoJsonRequestOptions, "body">,
    retryOptions: Pick<VideoJsonRequestRetryOptions, "requestTimeoutMs" | "serviceLabel" | "badRequestLabel"> = {},
): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), retryOptions.requestTimeoutMs ?? 15_000);
    try {
        const response = await fetch(url, {
            method: options.method,
            headers: options.headers,
            signal: controller.signal,
        });
        if (response.status === 404) return;
        if ([401, 403].includes(response.status)) {
            throw HttpErrorFactory.badRequest("主站密钥中的 apiKey 无效或无权限访问该模型");
        }
        if (!response.ok) {
            throw classifyVideoHttpError(response.status, await response.text(), 0, retryOptions);
        }
    } catch (error) {
        if (isAbortError(error)) {
            throw HttpErrorFactory.badRequest(`${retryOptions.serviceLabel ?? "视频接口"}连接测试超时，请稍后重试`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function normalizeVideoBaseUrl(value: string, label = "视频接口 Base URL"): string {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
        throw HttpErrorFactory.badRequest(`${label} 不能为空`);
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw HttpErrorFactory.badRequest(`${label} 格式不正确`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw HttpErrorFactory.badRequest(`${label} 仅支持 http/https`);
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest(`${label} 不允许包含用户名或密码`);
    }
    if (isPrivateOrLocalHost(url.hostname)) {
        throw HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }

    return trimmed;
}

export function safeJsonParse<T>(value: string): T | undefined {
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

async function executeVideoJsonRequest(
    url: string,
    options: VideoJsonRequestOptions,
    retryOptions: VideoJsonRequestRetryOptions,
    attempt: number,
): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), retryOptions.requestTimeoutMs ?? 120_000);
    try {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                ...options.headers,
            },
            body: options.body,
            signal: controller.signal,
        });
        const responseText = await response.text();
        if (!response.ok) {
            throw classifyVideoHttpError(response.status, responseText, attempt, retryOptions);
        }
        return safeJsonParse(responseText) ?? {};
    } catch (error) {
        if (isAbortError(error)) {
            throw HttpErrorFactory.badRequest(`${retryOptions.serviceLabel ?? "视频接口"}请求超时，请稍后重试`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function isRetryableVideoHttpError(error: Error): boolean {
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

function classifyVideoHttpError(
    status: number,
    body: string,
    attempt: number,
    options: Pick<VideoJsonRequestRetryOptions, "serviceLabel" | "badRequestLabel"> = {},
): Error {
    const prefix = attempt > 0 ? `(重试 ${attempt} 次后) ` : "";
    const truncated = body.length > 500 ? body.slice(0, 500) + "..." : body;
    const serviceLabel = options.serviceLabel ?? "视频服务";
    const badRequestLabel = options.badRequestLabel ?? "视频接口请求参数有误";

    switch (status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}${badRequestLabel}: ${truncated}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无效或已过期`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无权限访问该模型`);
        case 429:
            return HttpErrorFactory.badRequest(`${prefix}${serviceLabel}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return HttpErrorFactory.badRequest(`${prefix}${serviceLabel}暂时不可用 (${status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}${serviceLabel}请求失败: ${status} ${truncated}`);
    }
}

function isPrivateOrLocalHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local") ||
        host.startsWith("10.") ||
        host.startsWith("127.") ||
        host.startsWith("169.254.") ||
        host.startsWith("192.168.") ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
