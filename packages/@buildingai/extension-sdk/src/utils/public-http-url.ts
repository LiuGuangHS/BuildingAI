import { HttpErrorFactory } from "@buildingai/errors";
import { isPrivateOrReservedIp } from "@buildingai/utils";
import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface PublicHttpUrlOptions {
    label?: string;
}

export interface ResolvedPublicHttpUrl {
    normalized: string;
    url: URL;
    address: string;
    family: 4 | 6;
}

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

export { isPrivateOrReservedIp } from "@buildingai/utils";

export function normalizePublicHttpUrl(value: string, options: PublicHttpUrlOptions = {}) {
    const label = options.label ?? "URL";
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

    const hostname = normalizeHostname(url.hostname);
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
        throw HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }

    return trimmed;
}

export async function resolvePublicHttpUrl(value: string, options: PublicHttpUrlOptions = {}): Promise<ResolvedPublicHttpUrl> {
    const normalized = normalizePublicHttpUrl(value, options);
    const label = options.label ?? "URL";
    const url = new URL(normalized);
    const hostname = normalizeHostname(url.hostname);

    if (isIP(hostname)) {
        return {
            normalized,
            url,
            address: hostname,
            family: isIP(hostname) as 4 | 6,
        };
    }

    let addresses: LookupAddress[];
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw HttpErrorFactory.badRequest(`${label} 无法解析`);
    }
    if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
        throw HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    const firstAddress = addresses[0];
    if (!firstAddress) {
        throw HttpErrorFactory.badRequest(`${label} 无法解析`);
    }

    return {
        normalized,
        url,
        address: firstAddress.address,
        family: firstAddress.family as 4 | 6,
    };
}

export async function assertPublicHttpUrl(value: string, options: PublicHttpUrlOptions = {}) {
    const resolved = await resolvePublicHttpUrl(value, options);
    return resolved.normalized;
}
