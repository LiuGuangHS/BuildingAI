import { HttpErrorFactory } from "@buildingai/errors";
import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { isIP } from "node:net";

const MAX_PUSH_ENDPOINT_LENGTH = 2048;
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "updates-autopush.stage.mozaws.net",
    "updates-autopush.dev.mozaws.net",
    "web.push.apple.com",
    "api.push.apple.com",
    "wns.windows.com",
    "notify.windows.com",
];

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isPrivateOrReservedIpv4(address: string) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }

    const [a, b, c] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a === 169 && b === 254 ||
        a === 172 && b >= 16 && b <= 31 ||
        a === 192 && b === 0 && c === 0 ||
        a === 192 && b === 168 ||
        a === 198 && (b === 18 || b === 19) ||
        a === 100 && b >= 64 && b <= 127 ||
        a === 192 && b === 0 && c === 2 ||
        a === 198 && b === 51 && c === 100 ||
        a === 203 && b === 0 && c === 113 ||
        a >= 224
    );
}

function isPrivateOrReservedIpv6(address: string) {
    const normalized = address.toLowerCase();
    return (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80:") ||
        normalized.startsWith("ff")
    );
}

function isPrivateOrReservedIp(address: string) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return isPrivateOrReservedIpv4(mapped[1]);
    const family = isIP(address);
    if (family === 4) return isPrivateOrReservedIpv4(address);
    if (family === 6) return isPrivateOrReservedIpv6(address);
    return true;
}

function isAllowedPushEndpointHostname(hostname: string) {
    return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
}

export async function assertSafePushEndpoint(endpoint: string) {
    if (endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址过长");
    }

    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址无效");
    }

    if (url.protocol !== "https:") {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址必须使用 HTTPS");
    }
    if (url.username || url.password) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能包含凭据");
    }

    const hostname = normalizeHostname(url.hostname);
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
    }
    if (!isAllowedPushEndpointHostname(hostname)) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不是受支持的 Push 服务");
    }
    if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
    }

    let addresses: LookupAddress[];
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址无法解析");
    }
    if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
        throw HttpErrorFactory.badRequest("浏览器通知订阅地址不能指向本机或内网");
    }
}
