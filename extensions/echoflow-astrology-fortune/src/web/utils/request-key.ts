export function createAstrologyRequestKey(): string {
    const requestKey = globalThis.crypto?.randomUUID?.();
    if (!requestKey) throw new Error("当前浏览器不支持安全请求号生成");
    return requestKey;
}
