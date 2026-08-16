import type { ReactNode } from "react";

import type { GeneratedImageRecord } from "../services/types/generation";
import { useResultImage } from "./image-utils";

interface ControlledImageProps {
    image?: GeneratedImageRecord;
    generationId?: string;
    alt: string;
    className?: string;
    fallback?: ReactNode;
    scope?: "web" | "console";
}

export function ControlledImage({
    image,
    generationId,
    alt,
    className,
    fallback = null,
    scope = "web",
}: ControlledImageProps) {
    const src = useResultImage(image, generationId, scope);
    return src ? <img src={src} alt={alt} className={className} /> : fallback;
}
