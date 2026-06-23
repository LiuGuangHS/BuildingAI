"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrivateOrReservedIp = void 0;
exports.normalizePublicHttpUrl = normalizePublicHttpUrl;
exports.resolvePublicHttpUrl = resolvePublicHttpUrl;
exports.assertPublicHttpUrl = assertPublicHttpUrl;
const errors_1 = require("@buildingai/errors");
const utils_1 = require("@buildingai/utils");
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
function normalizeHostname(hostname) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
var utils_2 = require("@buildingai/utils");
Object.defineProperty(exports, "isPrivateOrReservedIp", { enumerable: true, get: function () { return utils_2.isPrivateOrReservedIp; } });
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
    if ((0, node_net_1.isIP)(hostname) && (0, utils_1.isPrivateOrReservedIp)(hostname)) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    return trimmed;
}
async function resolvePublicHttpUrl(value, options = {}) {
    const normalized = normalizePublicHttpUrl(value, options);
    const label = options.label ?? "URL";
    const url = new URL(normalized);
    const hostname = normalizeHostname(url.hostname);
    if ((0, node_net_1.isIP)(hostname)) {
        return {
            normalized,
            url,
            address: hostname,
            family: (0, node_net_1.isIP)(hostname),
        };
    }
    let addresses;
    try {
        addresses = await (0, promises_1.lookup)(hostname, { all: true, verbatim: true });
    }
    catch {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 无法解析`);
    }
    if (!addresses.length || addresses.some((item) => (0, utils_1.isPrivateOrReservedIp)(item.address))) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 不允许指向本机或内网地址`);
    }
    const firstAddress = addresses[0];
    if (!firstAddress) {
        throw errors_1.HttpErrorFactory.badRequest(`${label} 无法解析`);
    }
    return {
        normalized,
        url,
        address: firstAddress.address,
        family: firstAddress.family,
    };
}
async function assertPublicHttpUrl(value, options = {}) {
    const resolved = await resolvePublicHttpUrl(value, options);
    return resolved.normalized;
}
