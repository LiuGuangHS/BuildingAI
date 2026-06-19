"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrivateOrReservedIp = isPrivateOrReservedIp;
exports.normalizePublicHttpUrl = normalizePublicHttpUrl;
exports.assertPublicHttpUrl = assertPublicHttpUrl;
const errors_1 = require("@buildingai/errors");
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
function normalizeHostname(hostname) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
function isPrivateOrReservedIpv4(address) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }
    const [a = 0, b = 0, c = 0] = parts;
    return (a === 0 ||
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
        a >= 224);
}
function isPrivateOrReservedIpv6(address) {
    const normalized = address.toLowerCase();
    return (normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80:") ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:"));
}
function isPrivateOrReservedIp(address) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped?.[1])
        return isPrivateOrReservedIpv4(mapped[1]);
    const family = (0, node_net_1.isIP)(address);
    if (family === 4)
        return isPrivateOrReservedIpv4(address);
    if (family === 6)
        return isPrivateOrReservedIpv6(address);
    return true;
}
function normalizePublicHttpUrl(value, options = {}) {
    const label = options.label ?? "URL";
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不能为空`);
    }
    let url;
    try {
        url = new URL(trimmed);
    }
    catch {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 格式不正确`);
    }
    if (!["http:", "https:"].includes(url.protocol)) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 仅支持 http/https`);
    }
    if (url.username || url.password) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许包含用户名或密码`);
    }
    const hostname = normalizeHostname(url.hostname);
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    if ((0, node_net_1.isIP)(hostname) && isPrivateOrReservedIp(hostname)) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    return trimmed;
}
async function assertPublicHttpUrl(value, options = {}) {
    const normalized = normalizePublicHttpUrl(value, options);
    const label = options.label ?? "URL";
    const hostname = normalizeHostname(new URL(normalized).hostname);
    if ((0, node_net_1.isIP)(hostname)) {
        return normalized;
    }
    let addresses;
    try {
        addresses = await (0, promises_1.lookup)(hostname, { all: true, verbatim: true });
    }
    catch {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 无法解析`);
    }
    if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    return normalized;
}
