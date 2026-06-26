export class BaseService<T = unknown> {
    constructor(protected readonly repository?: { delete?: (id: string) => Promise<unknown> }) {}

    protected paginate() {
        return Promise.resolve({ items: [], total: 0 });
    }

    protected delete(id: string) {
        return this.repository?.delete?.(id) ?? Promise.resolve(undefined);
    }

    protected withTransaction<T>(callback: (manager: unknown) => Promise<T>): Promise<T> {
        return callback({
            findOne: (...args: unknown[]) => (this.repository as { findOne?: (...args: unknown[]) => Promise<unknown> })?.findOne?.(...args),
            save: async (_entity: unknown, value: T) => value,
        });
    }
}

export function InjectRepository() {
    return () => undefined;
}

export function ExtensionEntity() {
    return (target: unknown) => target;
}

export class User {}

export class Repository<T = unknown> {}

export class PublicAiModelService {}

export class ExtensionBillingService {}

export class SecretService {}

export class RedisModule {}

export class RedisService {}

export function Column() {
    return () => undefined;
}

export function CreateDateColumn() {
    return () => undefined;
}

export function UpdateDateColumn() {
    return () => undefined;
}

export function DeleteDateColumn() {
    return () => undefined;
}

export function PrimaryGeneratedColumn() {
    return () => undefined;
}

export function Index() {
    return () => undefined;
}

export function JoinColumn() {
    return () => undefined;
}

export function ManyToOne() {
    return () => undefined;
}

export function Like(value: string) {
    return value;
}

export function In<T>(value: T[]): T[] {
    return value;
}

export function buildWhere<T>(value: T): T {
    return value;
}

export function maskSensitiveValue(value: string) {
    if (!value) return "";
    if (value.length <= 8) return "*".repeat(value.length);
    return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`;
}

export function getProviderSecret(key: string, config: Record<string, { value?: string }>) {
    return config[key]?.value ?? "";
}

export function normalizeProviderConfig(config: Record<string, { value?: string }> = {}) {
    return {
        apiKey: config.apiKey?.value ?? config.api_key?.value ?? config.API_KEY?.value ?? "",
        baseURL: config.baseURL?.value ?? config.baseUrl?.value ?? config.base_url?.value ?? config.BASE_URL?.value ?? "",
        webhookSecret:
            config.webhookSecret?.value ??
            config.webhook_secret?.value ??
            config.WEBHOOK_SECRET?.value ??
            config.secret?.value ??
            config.SECRET?.value ??
            config.token?.value ??
            config.TOKEN?.value ??
            "",
    };
}

export async function resolveProviderSecretValue(options: {
    secretId: string;
    field: "apiKey" | "baseURL" | "webhookSecret";
    missingSecretMessage?: string;
    missingValueMessage?: string;
    secretConfigResolver: (secretId: string) => Promise<Record<string, { value?: string }>>;
}) {
    let config: Record<string, { value?: string }>;
    try {
        config = await options.secretConfigResolver(options.secretId);
    } catch {
        throw HttpErrorFactory.badRequest(options.missingSecretMessage ?? "主站密钥不存在或不可用");
    }

    const value = normalizeProviderConfig(config)[options.field];
    if (!value) {
        throw HttpErrorFactory.badRequest(options.missingValueMessage ?? `主站密钥中未找到 ${options.field} 字段`);
    }
    return value;
}

export function normalizePublicHttpUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) throw new Error("Base URL 不能为空");

    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Base URL 仅支持 http/https");
    }
    if (url.username || url.password) {
        throw new Error("Base URL 不允许包含用户名或密码");
    }

    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("10.") ||
        host.startsWith("127.") ||
        host.startsWith("169.254.") ||
        host.startsWith("192.168.") ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
        throw new Error("Base URL 不允许指向本机或内网地址");
    }

    return trimmed;
}

export async function assertPublicHttpUrl(value: string) {
    return normalizePublicHttpUrl(value);
}

export function normalizeProviderBaseUrl(value: string, label = "Provider Base URL") {
    try {
        return normalizePublicHttpUrl(value);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message.replace("Base URL", label));
    }
}

export type ProviderHttpErrorContext = {
    status: number;
    body: string;
    attempt: number;
    serviceLabel: string;
    badRequestLabel: string;
};

export async function requestProviderJson(
    url: string,
    options: {
        method: string;
        body?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
        maxRetries?: number;
        retryDelayMs?: number;
        serviceLabel?: string;
        badRequestLabel?: string;
        classifyError?: (context: ProviderHttpErrorContext) => Error;
    },
) {
    const maxRetries = options.maxRetries ?? 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: options.method,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...options.headers,
                },
                body: options.body,
            });
            const body = await response.text();
            if (response.ok) {
                return body ? JSON.parse(body) : {};
            }

            const context = {
                status: response.status,
                body,
                attempt,
                serviceLabel: options.serviceLabel ?? "Provider",
                badRequestLabel: options.badRequestLabel ?? "Provider 请求参数有误",
            };
            lastError = options.classifyError?.(context) ?? new Error(`${context.serviceLabel}请求失败: ${response.status} ${body}`);

            if (!isRetryableProviderHttpStatus(response.status) || attempt >= maxRetries) {
                throw lastError;
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt >= maxRetries || !isRetryableProviderError(lastError)) {
                throw lastError;
            }
        }
    }

    throw lastError ?? new Error("Provider request failed");
}

export async function testProviderJsonEndpoint(
    url: string,
    options: {
        method: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
        serviceLabel?: string;
        badRequestLabel?: string;
    },
) {
    const response = await fetch(url, {
        method: options.method,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    const body = await response.text();
    if (response.ok || response.status === 404) {
        return;
    }
    const serviceLabel = options.serviceLabel ?? "Provider";
    if (response.status === 401) {
        throw HttpErrorFactory.badRequest("主站密钥中的 apiKey 无效或已过期");
    }
    if (response.status === 403) {
        throw HttpErrorFactory.badRequest("主站密钥中的 apiKey 无权限访问该模型");
    }
    throw HttpErrorFactory.badRequest(`${serviceLabel}请求失败: ${response.status} ${body}`);
}

function isRetryableProviderHttpStatus(status: number) {
    return status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isRetryableProviderError(error: Error) {
    return /请求过于频繁|暂时不可用|timeout|timed out|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(error.message);
}

export class HttpError extends Error {
    constructor(
        message: string,
        public readonly options: { httpStatus: number; businessCode: number; data?: unknown },
    ) {
        super(message);
    }

    get httpStatus() {
        return this.options.httpStatus;
    }

    get businessCode() {
        return this.options.businessCode;
    }

    get data() {
        return this.options.data;
    }
}

export const HttpErrorFactory = {
    badRequest(message: string) {
        return new Error(message);
    },
    notFound(message: string) {
        return new Error(message);
    },
    tooManyRequests(message = "Too many requests", data?: unknown) {
        return new HttpError(message, { httpStatus: 429, businessCode: 40700, data });
    },
};

export const ACTION = {
    DEC: "dec",
    INC: "inc",
};
