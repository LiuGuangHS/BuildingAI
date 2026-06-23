const AI_OUTPUT_FORMAT_MESSAGE = "AI 返回的星盘报告格式异常，本次生成已失败并会按账务事实退款，请稍后重试。";

type AstrologyReportFailureType = "ai_output_format" | "provider_error";

export function buildAstrologyReportFailure(error: unknown) {
    const reason = getFailureReason(error);
    const failureType = isAiOutputFormatError(reason) ? "ai_output_format" : "provider_error";
    const message = failureType === "ai_output_format" ? AI_OUTPUT_FORMAT_MESSAGE : reason;

    return {
        message,
        metadata: {
            error: message,
            failureType,
            failureReason: reason,
        } satisfies {
            error: string;
            failureType: AstrologyReportFailureType;
            failureReason: string;
        },
    };
}

function getFailureReason(error: unknown) {
    if (error instanceof Error) return error.message || error.name || "未知错误";
    if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
        return error.message || "未知错误";
    }
    return String(error || "未知错误");
}

function isAiOutputFormatError(reason: string) {
    return /AI星盘报告(为空|不是有效 JSON|结构解析失败)/.test(reason) || reason.includes("AI星盘报告格式异常");
}
