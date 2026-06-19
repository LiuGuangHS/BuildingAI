import type { GenerateAstrologyReportDto } from "../dto";

export type AstrologyReportGenerationContext = {
    reportType: GenerateAstrologyReportDto["reportType"];
    focusArea?: string;
    currentState?: string;
    question?: string;
    language?: string;
    sourceReportId?: string;
    hasTargetProfile: boolean;
};

export function buildAstrologyReportGenerationContext(
    dto: GenerateAstrologyReportDto,
): AstrologyReportGenerationContext {
    return {
        reportType: dto.reportType,
        ...optionalString("focusArea", dto.focusArea),
        ...optionalString("currentState", dto.currentState),
        ...optionalString("question", dto.question),
        ...optionalString("language", dto.language),
        ...optionalString("sourceReportId", dto.sourceReportId),
        hasTargetProfile: Boolean(dto.targetProfile && Object.keys(dto.targetProfile).length),
    };
}

function optionalString<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
    if (typeof value !== "string") return {};
    const trimmed = value.trim();
    return trimmed ? ({ [key]: trimmed } as Record<Key, string>) : {};
}
