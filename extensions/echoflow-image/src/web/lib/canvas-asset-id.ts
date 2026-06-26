export function createCanvasAssetId(generationId: string | undefined, index: number) {
    return `${generationId ?? "draft"}-${index}-${crypto.randomUUID()}`;
}
