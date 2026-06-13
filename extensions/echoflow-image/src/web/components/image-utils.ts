import type { GeneratedImageRecord } from "../services/types/generation";

export function resolveImageSrc(image?: GeneratedImageRecord) {
    if (!image) return undefined;
    if (image.url && isSafeImageSrc(image.url)) return image.url;
    if (image.b64Json) {
        const dataUrl = `data:${image.mimeType || "image/png"};base64,${image.b64Json}`;
        return isSafeImageSrc(dataUrl) ? dataUrl : undefined;
    }
    return undefined;
}

export function downloadImage(src: string, filename = "echoflow-image-result.png") {
    if (!isSafeImageSrc(src)) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
}

export function isSafeImageSrc(src?: string) {
    if (!src) return false;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src)) return true;
    if (src.startsWith("/")) return true;

    try {
        const url = new URL(src);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
}
