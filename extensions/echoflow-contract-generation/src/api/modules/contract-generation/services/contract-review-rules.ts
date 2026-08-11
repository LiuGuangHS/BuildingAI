export const MAX_REVIEW_CHARS = 30000;

export type ReviewFindingEvidence = {
    sectionId?: string;
    sourceRevision?: number;
    sourceVersionId?: string;
    quote?: string;
    stale?: boolean;
};

export function isFindingCurrent(
    finding: ReviewFindingEvidence,
    document: { sectionId: string; revision: number; versionId?: string },
): boolean {
    return Boolean(
        finding.sectionId === document.sectionId &&
        finding.sourceRevision === document.revision &&
        (!finding.sourceVersionId || !document.versionId || finding.sourceVersionId === document.versionId) &&
        finding.quote?.trim() &&
        !finding.stale,
    );
}

export function canAcceptFinding(finding: ReviewFindingEvidence, document: { sectionId: string; revision: number; versionId?: string }): boolean {
    return isFindingCurrent(finding, document);
}

export function markFindingsStale<T extends ReviewFindingEvidence>(findings: T[] | undefined, nextRevision: number): T[] {
    return (findings ?? []).map((finding) => ({
        ...finding,
        stale: finding.sourceRevision !== nextRevision,
    }));
}

export function assertReviewContentWithinLimit(content: string): void {
    if (content.length > MAX_REVIEW_CHARS) {
        throw new Error(`合同正文超过审查长度上限（${MAX_REVIEW_CHARS} 字符），请先拆分文件后重试`);
    }
}
