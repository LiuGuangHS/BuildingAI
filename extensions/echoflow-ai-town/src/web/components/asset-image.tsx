import { useState } from "react";

type AssetImageProps = {
    src: string;
    alt: string;
    className?: string;
    fallback?: React.ReactNode;
};

export function AssetImage({ src, alt, className, fallback }: AssetImageProps) {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return <>{fallback ?? null}</>;
    }

    return <img alt={alt} className={className} src={src} onError={() => setFailed(true)} />;
}
