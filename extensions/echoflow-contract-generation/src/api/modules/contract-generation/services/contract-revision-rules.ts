export function isCurrentContractRevision(baseRevision: number, currentRevision: number) {
    return baseRevision === currentRevision;
}

export function nextContractRevision(currentRevision: number) {
    return currentRevision + 1;
}
