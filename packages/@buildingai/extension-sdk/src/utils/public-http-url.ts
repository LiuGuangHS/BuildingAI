import { HttpErrorFactory } from "@buildingai/errors";
import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface PublicHttpUrlOptions {
    label?: string;
}

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function isPrivateOrReservedIpv4(address: string) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }

    const [a = 0, b = 0, c = 0] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
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
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:")
    );
}

export function isPrivateOrReservedIp(address: string) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped?.[1]) return isPrivateOrReservedIpv4(mapped[1]);

    const family = isIP(address);
    if (family === 4) return isPrivateOrReservedIpv4(address);
    if (family === 6) return isPrivateOrReservedIpv6(address);
    return true;
}

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

export async function assertPublicHttpUrl(value: string, options: PublicHttpUrlOptions = {}) {
    const normalized = normalizePublicHttpUrl(value, options);
    const label = options.label ?? "URL";
    const hostname = normalizeHostname(new URL(normalized).hostname);

    if (isIP(hostname)) {
        return normalized;
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

    return normalized;
}
