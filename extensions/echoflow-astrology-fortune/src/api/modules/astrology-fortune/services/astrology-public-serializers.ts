import type { AstrologyProfile } from "../../../db/entities/astrology-profile.entity";
import type { AstrologyReport } from "../../../db/entities/astrology-report.entity";

export type PublicAstrologyProfile = Pick<
    AstrologyProfile,
    | "id"
    | "name"
    | "gender"
    | "birthDate"
    | "birthTime"
    | "birthPlace"
    | "zodiacSign"
    | "moonSign"
    | "risingSign"
    | "chineseZodiac"
    | "personalitySnapshot"
> & {
    createdAt: string;
    updatedAt: string;
};

export type ConsoleAstrologyProfile = PublicAstrologyProfile & {
    userId: string;
};

type PublicAstrologyReportMetadata = {
    feedback?: {
        rating?: string;
        note?: string;
        updatedAt?: string;
    };
    sourceReport?: {
        id?: string;
        reportType?: string;
        title?: string | null;
    };
    generationContext?: {
        reportType?: string;
        focusArea?: string;
        currentState?: string;
        question?: string;
        language?: string;
        sourceReportId?: string;
        hasTargetProfile?: boolean;
        questionQuality?: {
            level?: string;
            score?: number;
            signals?: string[];
            missing?: string[];
        };
    };
};

type ConsoleAstrologyReportMetadata = PublicAstrologyReportMetadata & {
    failureType?: string;
    hasRefundError?: boolean;
    aiRepairAttempted?: boolean;
    aiRepairSucceeded?: boolean;
};

type PublicAstrologyReport = Pick<
    AstrologyReport,
    | "id"
    | "profileId"
    | "reportType"
    | "question"
    | "status"
    | "result"
    | "resultText"
    | "score"
    | "tags"
    | "isFavorite"
    | "costCredits"
> & {
    errorMessage?: string;
    providerMetadata: PublicAstrologyReportMetadata;
    createdAt: string;
    updatedAt: string;
};

export type ConsoleAstrologyReport = Omit<PublicAstrologyReport, "providerMetadata"> & {
    userId: string;
    modelId: string;
    providerId: string;
    providerMetadata: ConsoleAstrologyReportMetadata;
};

export function toPublicAstrologyProfile(profile: AstrologyProfile): PublicAstrologyProfile {
    return {
        id: profile.id,
        name: profile.name,
        gender: profile.gender ?? null,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime ?? null,
        birthPlace: profile.birthPlace ?? null,
        zodiacSign: profile.zodiacSign,
        moonSign: profile.moonSign ?? null,
        risingSign: profile.risingSign ?? null,
        chineseZodiac: profile.chineseZodiac,
        personalitySnapshot: profile.personalitySnapshot,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
}

export function toConsoleAstrologyProfile(profile: AstrologyProfile): ConsoleAstrologyProfile {
    return {
        ...toPublicAstrologyProfile(profile),
        userId: profile.userId,
    };
}

export function toPublicAstrologyReport(report: AstrologyReport): PublicAstrologyReport {
    return {
        id: report.id,
        profileId: report.profileId ?? null,
        reportType: report.reportType,
        question: report.question ?? null,
        status: report.status,
        result: report.result ?? null,
        resultText: report.resultText ?? null,
        score: report.score ?? null,
        tags: report.tags,
        isFavorite: report.isFavorite,
        costCredits: report.costCredits,
        errorMessage: report.errorMessage ? "报告生成失败，请稍后重试" : undefined,
        providerMetadata: toPublicAstrologyReportMetadata(report.providerMetadata),
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
    };
}

export function toConsoleAstrologyReport(report: AstrologyReport): ConsoleAstrologyReport {
    const publicReport = toPublicAstrologyReport(report);
    return {
        ...publicReport,
        userId: report.userId,
        modelId: report.modelId,
        providerId: report.providerId,
        providerMetadata: {
            ...publicReport.providerMetadata,
            ...(typeof report.providerMetadata?.failureType === "string" ? { failureType: report.providerMetadata.failureType } : {}),
            ...(typeof report.providerMetadata?.aiRepairAttempted === "boolean" ? { aiRepairAttempted: report.providerMetadata.aiRepairAttempted } : {}),
            ...(typeof report.providerMetadata?.aiRepairSucceeded === "boolean" ? { aiRepairSucceeded: report.providerMetadata.aiRepairSucceeded } : {}),
            ...(report.providerMetadata?.refundError ? { hasRefundError: true } : {}),
        },
    };
}

function toPublicAstrologyReportMetadata(metadata: Record<string, unknown> | null | undefined): PublicAstrologyReportMetadata {
    const feedback = toRecord(metadata?.feedback);
    const sourceReport = toRecord(metadata?.sourceReport);
    const generationContext = toRecord(metadata?.generationContext);
    const questionQuality = toRecord(generationContext?.questionQuality);

    return {
        ...(feedback
            ? {
                  feedback: {
                      ...(typeof feedback.rating === "string" ? { rating: feedback.rating } : {}),
                      ...(typeof feedback.note === "string" ? { note: feedback.note } : {}),
                      ...(typeof feedback.updatedAt === "string" ? { updatedAt: feedback.updatedAt } : {}),
                  },
              }
            : {}),
        ...(sourceReport
            ? {
                  sourceReport: {
                      ...(typeof sourceReport.id === "string" ? { id: sourceReport.id } : {}),
                      ...(typeof sourceReport.reportType === "string" ? { reportType: sourceReport.reportType } : {}),
                      ...(typeof sourceReport.title === "string" || sourceReport.title === null ? { title: sourceReport.title } : {}),
                  },
              }
            : {}),
        ...(generationContext
            ? {
                  generationContext: {
                      ...(typeof generationContext.reportType === "string" ? { reportType: generationContext.reportType } : {}),
                      ...(typeof generationContext.focusArea === "string" ? { focusArea: generationContext.focusArea } : {}),
                      ...(typeof generationContext.currentState === "string" ? { currentState: generationContext.currentState } : {}),
                      ...(typeof generationContext.question === "string" ? { question: generationContext.question } : {}),
                      ...(typeof generationContext.language === "string" ? { language: generationContext.language } : {}),
                      ...(typeof generationContext.sourceReportId === "string" ? { sourceReportId: generationContext.sourceReportId } : {}),
                      ...(typeof generationContext.hasTargetProfile === "boolean" ? { hasTargetProfile: generationContext.hasTargetProfile } : {}),
                      ...(questionQuality
                          ? {
                                questionQuality: {
                                    ...(typeof questionQuality.level === "string" ? { level: questionQuality.level } : {}),
                                    ...(typeof questionQuality.score === "number" ? { score: questionQuality.score } : {}),
                                    ...(isStringArray(questionQuality.signals) ? { signals: questionQuality.signals } : {}),
                                    ...(isStringArray(questionQuality.missing) ? { missing: questionQuality.missing } : {}),
                                },
                            }
                          : {}),
                  },
              }
            : {}),
    };
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
