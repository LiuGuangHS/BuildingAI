import { apiHttpClient, consoleHttpClient } from "../services/base";
import type { GeneratedImageRecord } from "../services/types/generation";
import { useEffect, useState } from "react";

export function resolveImageSrc(image?: GeneratedImageRecord, generationId?: string) {
    if (!image?.fileId || !generationId) return undefined;
    return `/generation/results/${generationId}/${image.fileId}`;
}

export async function fetchResultImage(
    image?: GeneratedImageRecord,
    generationId?: string,
    scope: "web" | "console" = "web",
): Promise<string | undefined> {
    const path = resolveImageSrc(image, generationId);
    if (!path) return undefined;
    const client = scope === "console" ? consoleHttpClient : apiHttpClient;
    return URL.createObjectURL(await client.download(path));
}

export function revokeImageSrc(src?: string): void {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
}

export function useResultImage(image?: GeneratedImageRecord, generationId?: string, scope: "web" | "console" = "web") {
    const [src, setSrc] = useState<string>();

    useEffect(() => {
        let active = true;
        let current: string | undefined;
        void fetchResultImage(image, generationId, scope)
            .then((value) => {
                if (!active) {
                    revokeImageSrc(value);
                    return;
                }
                current = value;
                setSrc(value);
            })
            .catch(() => active && setSrc(undefined));
        return () => {
            active = false;
            revokeImageSrc(current);
        };
    }, [image?.fileId, generationId, scope]);

    return src;
}

export async function openImage(
    image: GeneratedImageRecord,
    generationId?: string,
    scope: "web" | "console" = "web",
): Promise<void> {
    const target = window.open("", "_blank");
    if (!target) return;
    target.opener = null;
    try {
        const src = await fetchResultImage(image, generationId, scope);
        if (!src) {
            target.close();
            return;
        }
        target.location.href = src;
        target.addEventListener("load", () => revokeImageSrc(src), { once: true });
    } catch {
        target.close();
    }
}

export async function downloadImage(
    image: GeneratedImageRecord | string,
    generationIdOrFilename?: string,
    filename = "echoflow-image-result.png",
    scope: "web" | "console" = "web",
): Promise<void> {
    const src = typeof image === "string"
        ? image
        : await fetchResultImage(image, generationIdOrFilename, scope);
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = typeof image === "string" ? generationIdOrFilename || filename : filename;
    link.click();
    if (typeof image !== "string") revokeImageSrc(src);
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
