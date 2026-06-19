export class BaseService<T = unknown> {
    constructor(protected readonly repository?: { delete?: (id: string) => Promise<unknown> }) {}

    protected paginate() {
        return Promise.resolve({ items: [], total: 0 });
    }

    protected delete(id: string) {
        return this.repository?.delete?.(id) ?? Promise.resolve(undefined);
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

export function isPrivateOrReservedIp() {
    return false;
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

export const ACCOUNT_LOG_TYPE = {
    PLUGIN_DEC: "plugin_dec",
};

export const ACTION = {
    DEC: "dec",
    INC: "inc",
};
