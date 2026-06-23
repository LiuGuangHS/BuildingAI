import { isPrivateOrReservedIp } from "@buildingai/utils";
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
