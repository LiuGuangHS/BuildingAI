type GenerateAstrologyReportAiResultWithRepairOptions<Result, Parsed> = {
    basePrompt: string;
    generate: (prompt: string) => Promise<Result>;
    parse: (payload: Result) => Parsed;
};

export async function generateAstrologyReportAiResultWithRepair<Result, Parsed>(
    options: GenerateAstrologyReportAiResultWithRepairOptions<Result, Parsed>,
) {
    const firstResult = await options.generate(options.basePrompt);
    try {
        return { result: options.parse(firstResult), metadata: {} };
    } catch (error) {
        if (!isAstrologyReportFormatError(error)) throw error;
        const reason = sanitizeRepairReason(error instanceof Error ? error.message : String(error));
        const repairedResult = await options.generate(buildAstrologyReportRepairPrompt(options.basePrompt, error));
        return {
            result: options.parse(repairedResult),
            metadata: {
                aiRepairAttempted: true,
                aiRepairSucceeded: true,
                aiRepairReason: reason,
            },
        };
    }
}

export function buildAstrologyReportRepairPrompt(basePrompt: string, error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return `${basePrompt}

上一次 AI 输出未通过结构校验：${sanitizeRepairReason(reason)}
请重新生成完整报告，并严格遵守上面的 JSON schema、证据来源、行动建议、风险提醒、复盘清单和继续追问要求。
不得使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺；需要表达不确定性时改写为建议、观察信号或边界提醒。
只输出修复后的 JSON 对象，不要输出 Markdown、代码块、解释文字、平台配置、密钥、调试字段或任何调试信息。`;
}

function isAstrologyReportFormatError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /AI星盘报告结构解析失败|AI星盘报告不是有效 JSON|AI星盘报告为空/.test(message);
}

function sanitizeRepairReason(reason: string) {
    return reason.replace(/(api[_-]?key|secret|provider|baseURL|baseUrl|base_url)\s*[:=]\s*\\S+/gi, "$1=[redacted]").slice(0, 300);
}
