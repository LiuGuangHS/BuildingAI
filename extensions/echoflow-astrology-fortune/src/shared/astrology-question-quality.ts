type QuestionQualitySignalCode = "scene" | "time" | "goal" | "detail" | "state";

export type AstrologyQuestionQualitySignal = {
    code: QuestionQualitySignalCode;
    label: string;
    present: boolean;
};

export type AstrologyQuestionQualityLevel = "weak" | "usable" | "strong";

export type AstrologyQuestionQualityContext = {
    score: number;
    level: AstrologyQuestionQualityLevel;
    signals: AstrologyQuestionQualitySignal[];
    suggestions: string[];
};

type AstrologyQuestionQualityInput = {
    focusArea?: string | null;
    currentState?: string | null;
    question?: string | null;
};

type NormalizedQuestionQualityInput = {
    focusArea: string;
    currentState: string;
    question: string;
};

const SIGNALS: Array<{
    code: QuestionQualitySignalCode;
    label: string;
    suggestion: string;
    test: (input: NormalizedQuestionQualityInput) => boolean;
}> = [
    {
        code: "scene",
        label: "具体场景",
        suggestion: "补充具体场景",
        test: ({ focusArea, currentState, question }) => /关系|工作|事业|财富|感情|沟通|选择|机会|复合|推进|决定|合作|资源|状态|情绪|档案|配对/.test(`${focusArea} ${currentState} ${question}`),
    },
    {
        code: "time",
        label: "时间范围",
        suggestion: "说明时间范围",
        test: ({ currentState, question }) => /今天|明天|本周|这周|近期|未来|七天|7天|一周|一个月|现在|当前|阶段/.test(`${currentState} ${question}`),
    },
    {
        code: "goal",
        label: "决策目标",
        suggestion: "写清想判断的目标",
        test: ({ question }) => /应该|适合|要不要|是否|如何|怎么|风险|机会|行动|建议|避开|观察|判断|推进/.test(question),
    },
    {
        code: "detail",
        label: "问题细节",
        suggestion: "把问题写得更具体",
        test: ({ question }) => question.trim().length >= 18,
    },
    {
        code: "state",
        label: "当前状态",
        suggestion: "补充当前状态",
        test: ({ currentState }) => currentState.trim().length >= 8,
    },
];

export function buildAstrologyQuestionQualityContext(input: AstrologyQuestionQualityInput): AstrologyQuestionQualityContext {
    const normalized = {
        focusArea: input.focusArea?.trim() ?? "",
        currentState: input.currentState?.trim() ?? "",
        question: input.question?.trim() ?? "",
    };
    const signals = SIGNALS.map(({ code, label, test }) => ({
        code,
        label,
        present: test(normalized),
    }));
    const passed = signals.filter((item) => item.present).length;
    const score = Math.max(10, Math.round((passed / signals.length) * 100));
    const level: AstrologyQuestionQualityLevel = score >= 80 ? "strong" : score >= 50 ? "usable" : "weak";
    const suggestions = SIGNALS.filter((rule) => !signals.find((signal) => signal.code === rule.code)?.present).map((rule) => rule.suggestion);

    return {
        score,
        level,
        signals,
        suggestions,
    };
}

export function summarizeAstrologyQuestionQuality(context: AstrologyQuestionQualityContext) {
    const included = context.signals.filter((item) => item.present).map((item) => item.label).join("、") || "暂无";
    const missing = context.suggestions.join("、") || "无需补充";
    return `问题质量: ${context.level}\n得分: ${context.score}\n已包含: ${included}\n建议补充: ${missing}`;
}
