import { HttpErrorFactory } from "@buildingai/errors";
import {
    requestProviderJson,
    testProviderJsonEndpoint,
    type ProviderHttpErrorContext,
} from "@buildingai/extension-sdk";

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
    return requestProviderJson(url, {
        method: options.method,
        body: options.body,
        headers: options.headers,
        timeoutMs: retryOptions.requestTimeoutMs,
        maxRetries: retryOptions.maxRetries,
        retryDelayMs: retryOptions.retryDelayMs,
        serviceLabel: retryOptions.serviceLabel ?? "视频接口",
        badRequestLabel: retryOptions.badRequestLabel ?? "视频接口请求参数有误",
        classifyError: (context) => classifyVideoHttpError(context),
    });
}

export async function testVideoJsonEndpoint(
    url: string,
    options: Omit<VideoJsonRequestOptions, "body">,
    retryOptions: Pick<VideoJsonRequestRetryOptions, "requestTimeoutMs" | "serviceLabel" | "badRequestLabel"> = {},
): Promise<void> {
    return testProviderJsonEndpoint(url, {
        method: options.method,
        headers: options.headers,
        timeoutMs: retryOptions.requestTimeoutMs,
        serviceLabel: retryOptions.serviceLabel ?? "视频接口",
        badRequestLabel: retryOptions.badRequestLabel ?? "视频接口请求参数有误",
    });
}

function classifyVideoHttpError(context: ProviderHttpErrorContext): Error {
    const prefix = context.attempt > 0 ? `(重试 ${context.attempt} 次后) ` : "";

    switch (context.status) {
        case 400:
            return HttpErrorFactory.badRequest(`${prefix}${context.badRequestLabel}`);
        case 401:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无效或已过期`);
        case 403:
            return HttpErrorFactory.badRequest(`${prefix}主站密钥中的 apiKey 无权限访问该模型`);
        case 429:
            return HttpErrorFactory.badRequest(`${prefix}${context.serviceLabel}请求过于频繁，请稍后重试`);
        case 500:
        case 502:
        case 503:
        case 504:
            return HttpErrorFactory.badRequest(`${prefix}${context.serviceLabel}暂时不可用 (${context.status})，请稍后重试`);
        default:
            return HttpErrorFactory.badRequest(`${prefix}${context.serviceLabel}请求失败: ${context.status}`);
    }
}
