let assetCounter = 0;

export function createCanvasAssetId(generationId: string | undefined, index: number) {
    assetCounter += 1;
    const randomPart =
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8)
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    return `${generationId ?? "draft"}-${index}-${assetCounter}-${randomPart}`;
}
