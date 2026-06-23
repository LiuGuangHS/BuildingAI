import type { UpdateReportFeedbackDto } from "../dto";

export type AstrologyReportFeedbackMetadata = {
    rating: UpdateReportFeedbackDto["rating"];
    note?: string;
    updatedAt: string;
};

export function buildAstrologyReportFeedbackMetadata(
    existingMetadata: Record<string, unknown> | null | undefined,
    feedback: UpdateReportFeedbackDto,
    updatedAt = new Date().toISOString(),
) {
    const note = feedback.note?.trim();
    return {
        ...(existingMetadata ?? {}),
        feedback: {
            rating: feedback.rating,
            ...(note ? { note } : {}),
            updatedAt,
        } satisfies AstrologyReportFeedbackMetadata,
    };
}
