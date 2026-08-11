export function isGenerationUnavailable(status: {
    isPending: boolean;
    isError: boolean;
    canGenerate?: boolean;
}): boolean {
    return status.isPending || status.isError || status.canGenerate === false;
}
