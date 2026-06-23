import { buildDefinedWhere } from "@buildingai/extension-sdk/utils/pure";
import type { GenerateAstrologyReportDto } from "../dto";
import type { AstrologyQuestionQualityContext } from "./astrology-question-quality";

export type AstrologyReportGenerationContext = {
    reportType: GenerateAstrologyReportDto["reportType"];
    focusArea?: string;
    currentState?: string;
    question?: string;
    language?: string;
    sourceReportId?: string;
    hasTargetProfile: boolean;
    questionQuality: {
        level: "weak" | "usable" | "strong";
        score: number;
        signals: string[];
        missing: string[];
    };
};

export function buildAstrologyReportGenerationContext(
    dto: GenerateAstrologyReportDto,
    questionQuality: AstrologyQuestionQualityContext,
): AstrologyReportGenerationContext {
    return {
        reportType: dto.reportType,
        ...buildDefinedWhere<Partial<AstrologyReportGenerationContext>>({
            focusArea: normalizeOptionalText(dto.focusArea),
            currentState: normalizeOptionalText(dto.currentState),
            question: normalizeOptionalText(dto.question),
            language: normalizeOptionalText(dto.language),
            sourceReportId: normalizeOptionalText(dto.sourceReportId),
        }),
        hasTargetProfile: Boolean(dto.targetProfile && Object.keys(dto.targetProfile).length),
        questionQuality: {
            level: questionQuality.level,
            score: questionQuality.score,
            signals: questionQuality.signals.filter((item) => item.present).map((item) => item.label),
            missing: questionQuality.suggestions,
        },
    };
}

function normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}
