import { BusinessCode } from "@buildingai/constants/shared/business-code.constant";
import { createHttpClient, createStandardApiParser, type HttpError } from "@buildingai/http";
import { useAuthStore } from "@buildingai/stores";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { getFirstConsoleMenuPath, hasConsoleAccess, WEB_HOME_PATH } from "./shared/console-access";

const isDev = import.meta.env.DEV;
const devBase = import.meta.env.VITE_DEVELOP_APP_BASE_URL;
const prodBase = import.meta.env.VITE_PRODUCTION_APP_BASE_URL;

export function generateWebApiBase() {
    const base: string = isDev ? devBase : prodBase;
    return `${base}${import.meta.env.VITE_APP_WEB_API_PREFIX || "/api"}`;
}

const BUSINESS_ERROR_MESSAGES: Record<string, Record<string, string>> = {
    "zh-CN": {
        [BusinessCode.LOGIN_FAILED]: "账号或密码错误，请检查后重试",
    },
    "en-US": {
        [BusinessCode.LOGIN_FAILED]: "Invalid account or password.",
    },
};

function getLocale() {
    return localStorage.getItem("buildingai-ui-locale") || navigator.language || "zh-CN";
}

function getBusinessErrorMessage(code?: unknown) {
    const locale = getLocale().startsWith("zh") ? "zh-CN" : "en-US";
    return BUSINESS_ERROR_MESSAGES[locale]?.[String(code)];
}

function getHttpErrorMessage(error: HttpError): string {
    return getBusinessErrorMessage(error.code) || error.message || "请求失败";
}

function handleHttpError(error: HttpError): void {
    toast.error(getHttpErrorMessage(error));
}

async function handleAuthError(error: unknown): Promise<void> {
    if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError<{ code?: string; message?: string }>;
        const message = getBusinessErrorMessage(axiosError.response?.data?.code) ?? axiosError.response?.data?.message;
        if (message) {
            toast.error(message);
        }
    }
    await useAuthStore.getState().authActions.logout();

    if (location.pathname.includes("/login")) {
        return;
    }
    location.replace(`/login?redirect=${location.pathname}`);
}

async function handleAccessError(): Promise<void> {
    const userInfo = useAuthStore.getState().auth.userInfo;
    const target = hasConsoleAccess(userInfo)
        ? getFirstConsoleMenuPath(userInfo?.menus ?? [])
        : WEB_HOME_PATH;

    if (location.pathname !== target) {
        location.replace(target);
    }
}

export const apiHttpClient = createHttpClient({
    baseURL: isDev ? devBase : prodBase,
    pathPrefix: import.meta.env.VITE_APP_WEB_API_PREFIX || "/api",
    parseResponse: createStandardApiParser(),
    hooks: {
        getAccessToken: async () => {
            return useAuthStore.getState().auth.token || "";
        },
        onAuthError: handleAuthError,
        onAccessError: handleAccessError,
        onError: handleHttpError,
    },
});

export const consoleHttpClient = createHttpClient({
    baseURL: isDev ? devBase : prodBase,
    pathPrefix: import.meta.env.VITE_APP_CONSOLE_API_PREFIX || "/console",
    parseResponse: createStandardApiParser(),
    hooks: {
        getAccessToken: async () => {
            return useAuthStore.getState().auth.token || "";
        },
        onAuthError: handleAuthError,
        onAccessError: handleAccessError,
        onError: handleHttpError,
    },
});

/**
 * Extract plugin identifier from URL path
 * URL format: domain/{pluginIdentifier}/xxx
 */
function getPluginIdentifierFromUrl(): string {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/extension\/([^/]+)/);
    if (!match) {
        throw new Error("Unable to extract plugin identifier from URL path");
    }
    return match[1] || "unknow";
}

async function handlePluginAuthError(error: unknown): Promise<void> {
    if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError<{ code?: string; message?: string }>;
        const message = getBusinessErrorMessage(axiosError.response?.data?.code) ?? axiosError.response?.data?.message;
        if (message) {
            toast.error(message);
        }
    }
    await useAuthStore.getState().authActions.logout();

    if (isDev) {
        location.replace(`${devBase}/login?redirect=${encodeURIComponent(location.href)}`);
    } else {
        location.replace(`/login?redirect=${location.pathname}`);
    }
}

/**
 * Create plugin-specific HTTP clients with plugin identifier in path prefix
 * @param pluginIdentifier - Plugin unique identifier, if not provided, will extract from URL
 * @returns Object containing apiHttpClient and consoleHttpClient for plugin
 */
export function createPluginHttpClients(pluginIdentifier?: string) {
    const identifier = pluginIdentifier || getPluginIdentifierFromUrl();

    const pluginApiHttpClient = createHttpClient({
        baseURL: isDev ? devBase : prodBase,
        pathPrefix: `/${identifier}${import.meta.env.VITE_APP_WEB_API_PREFIX || "/api"}`,
        parseResponse: createStandardApiParser(),
        hooks: {
            getAccessToken: async () => {
                return useAuthStore.getState().auth.token || "";
            },
            onAuthError: handlePluginAuthError,
            onAccessError: handleAccessError,
            onError: handleHttpError,
        },
    });

    const pluginConsoleHttpClient = createHttpClient({
        baseURL: isDev ? devBase : prodBase,
        pathPrefix: `/${identifier}${import.meta.env.VITE_APP_CONSOLE_API_PREFIX || "/console"}`,
        parseResponse: createStandardApiParser(),
        hooks: {
            getAccessToken: async () => {
                return useAuthStore.getState().auth.token || "";
            },
            onAuthError: handlePluginAuthError,
            onAccessError: handleAccessError,
            onError: handleHttpError,
        },
    });

    return {
        apiHttpClient: pluginApiHttpClient,
        consoleHttpClient: pluginConsoleHttpClient,
    };
}
