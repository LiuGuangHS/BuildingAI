import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
    normalizeAstrologyReportAiResult,
    parseAstrologyReportAiResult,
} from "../src/api/modules/astrology-fortune/services/astrology-report-ai-result.ts";

const validPayload = {
    title: "本周关系节奏",
    summary: "适合先观察再推进，沟通要具体。",
    scores: { overall: 82, love: 78 },
    keywords: ["观察", "沟通", "节奏"],
    lucky: { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" },
    evidence: [
        { source: "当前问题", insight: "用户给出了未来一周的时间范围和沟通目标。", confidence: "high" },
        { source: "关系状态", insight: "沟通减少说明需要先确认对方节奏。", confidence: "medium" },
    ],
    sections: [
        { heading: "洞察", content: "当前更适合看清对方反馈。" },
        { heading: "机会", content: "轻量表达会降低压力。" },
        { heading: "风险", content: "避免一次性提出过多要求。" },
        { heading: "行动", content: "先约定一个短沟通窗口。" },
    ],
    actions: [
        { item: "先确认对方节奏", reason: "关系状态显示沟通减少，需要先确认对方节奏。", timebox: "未来24小时" },
        { item: "用具体沟通目标开启对话", reason: "当前问题已经给出沟通目标，具体问题更容易获得回应。", timebox: "下次沟通" },
        { item: "保留沟通目标复盘", reason: "当前问题包含沟通目标，复盘可以验证互动质量是否改善。", timebox: "未来3天" },
    ],
    warnings: [
        { title: "不要把沉默理解为拒绝", detail: "沉默也可能只是对方节奏变慢，需要更多观察信号。" },
        { title: "避免情绪化催促", detail: "关系状态已经沟通减少，催促会让对方节奏更慢。" },
    ],
    reviewChecklist: [
        {
            item: "未来三天记录对方是否主动回应具体安排",
            why: "这能验证关系节奏是否真的适合轻量推进",
            evidenceSource: "关系状态",
            timebox: "未来3天",
        },
        {
            item: "把沟通目标压缩成一个可回答的问题",
            why: "问题越具体，越能避免一次性提出过多要求",
            evidenceSource: "当前问题",
            timebox: "下次沟通前",
        },
    ],
    followUps: [
        "如果我先观察，未来三天应该重点看哪些信号？",
        "把这份建议改成一段可以直接发给对方的话。",
    ],
    closing: "把直觉变成行动前，先给事实一点时间。",
};

describe("astrology report AI result contract", () => {
    it("parses SDK object output when the platform can provide structured output", () => {
        assert.deepEqual(parseAstrologyReportAiResult({ output: validPayload }), validPayload);
    });

    it("parses plain JSON text returned by the SDK text generation entrypoint", () => {
        assert.deepEqual(parseAstrologyReportAiResult({ text: JSON.stringify(validPayload) }), validPayload);
    });

    it("parses common SDK text aliases and chat completion shaped output", () => {
        assert.deepEqual(parseAstrologyReportAiResult({ outputText: JSON.stringify(validPayload) }), validPayload);
        assert.deepEqual(parseAstrologyReportAiResult({ output_text: JSON.stringify(validPayload) }), validPayload);
        assert.deepEqual(
            parseAstrologyReportAiResult({
                choices: [{ message: { content: JSON.stringify(validPayload) } }],
            }),
            validPayload,
        );
    });

    it("parses fenced or narrated JSON without trusting non-JSON text", () => {
        assert.deepEqual(parseAstrologyReportAiResult({ text: `\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\`` }), validPayload);
        assert.deepEqual(parseAstrologyReportAiResult({ text: `下面是报告：${JSON.stringify(validPayload)}请查收。` }), validPayload);
    });

    it("normalizes report content for persistence and user rendering", () => {
        const normalized = normalizeAstrologyReportAiResult({
            ...validPayload,
            title: "  本周关系节奏  ",
            keywords: ["  观察  ", "", "沟通"],
            sections: [{ heading: "  洞察  ", content: "  先看反馈。  " }],
        });

        assert.equal(normalized.title, "本周关系节奏");
        assert.deepEqual(normalized.keywords, ["观察", "沟通"]);
        assert.deepEqual(normalized.sections, [{ heading: "洞察", content: "先看反馈。" }]);
        assert.deepEqual(normalized.evidence, validPayload.evidence);
        assert.deepEqual(normalized.actions, validPayload.actions);
        assert.deepEqual(normalized.warnings, validPayload.warnings);
        assert.deepEqual(normalized.reviewChecklist, validPayload.reviewChecklist);
        assert.deepEqual(normalized.followUps, validPayload.followUps);
    });

    it("rejects user-provided moon and rising signs presented as computed chart facts", () => {
        const computedClaims = [
            ["月亮落在双子座", "当前问题"],
            ["上升点位于狮子座", "当前问题"],
            ["月亮星座为双子座", "用户档案"],
            ["上升星座是狮子座", "用户档案"],
            ["第七宫有重要相位", "用户档案"],
        ];
        for (const [insight, source] of computedClaims) {
            assert.throws(
                () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, evidence: [{ source, insight, confidence: "high" }, validPayload.evidence[1]] }) }),
                /AI星盘报告结构解析失败/,
            );
        }
    });

    it("rejects empty, invalid, or schema-breaking model output", () => {
        const { evidence, ...payloadWithoutEvidence } = validPayload;

        assert.throws(() => parseAstrologyReportAiResult({ text: "" }), /AI星盘报告为空/);
        assert.throws(() => parseAstrologyReportAiResult({ text: "不是 JSON" }), SyntaxError);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, scores: { overall: 120 } }) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, title: "   " }) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, summary: "   " }) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify(payloadWithoutEvidence) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, evidence: [] }) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, reviewChecklist: [] }) }), /AI星盘报告结构解析失败/);
        assert.throws(() => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, followUps: [] }) }), /AI星盘报告结构解析失败/);
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        evidence: [
                            { source: "", insight: "用户提供了明确问题。" },
                            { source: "当前问题", insight: "" },
                        ],
                    }),
                }),
            /AI星盘报告结构解析失败/,
        );
    });

    it("rejects model output without explicit user-facing score anchors", () => {
        const { scores, ...payloadWithoutScores } = validPayload;

        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify(payloadWithoutScores) }),
            /AI星盘报告结构解析失败: scores/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, scores: {} }) }),
            /AI星盘报告结构解析失败: scores/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, scores: { love: 78 } }) }),
            /AI星盘报告结构解析失败: scores/,
        );
    });

    it("rejects model output without user-facing keywords or lucky anchors", () => {
        const { keywords, lucky, ...payloadWithoutDisplayAnchors } = validPayload;

        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, keywords: ["观察", ""] }) }),
            /AI星盘报告结构解析失败: keywords/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, lucky: { color: "蓝色" } }) }),
            /AI星盘报告结构解析失败: lucky/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify(payloadWithoutDisplayAnchors) }),
            /AI星盘报告结构解析失败: keywords, lucky/,
        );
    });

    it("rejects review checklist evidence sources that cannot be traced to the report", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        reviewChecklist: [
                            {
                                item: "观察一个模型没有解释过的信号",
                                why: "这条复盘无法回到本次报告依据、行动或风险",
                                evidenceSource: "未提供的星体相位",
                                timebox: "未来3天",
                            },
                            validPayload.reviewChecklist[1],
                        ],
                    }),
                }),
            /AI星盘报告结构解析失败: reviewChecklist\.0\.evidenceSource/,
        );
    });

    it("rejects model output that omits executable sections, actions, or warnings", () => {
        const { sections, actions, warnings, ...withoutExecutableStructure } = validPayload;

        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify(withoutExecutableStructure) }),
            /AI星盘报告结构解析失败: sections/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, actions: [] }) }),
            /AI星盘报告结构解析失败: actions/,
        );
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...validPayload, warnings: [] }) }),
            /AI星盘报告结构解析失败: warnings/,
        );
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        actions: [{ item: "先确认对方时间", reason: "", timebox: "未来24小时" }, validPayload.actions[1], validPayload.actions[2]],
                    }),
                }),
            /AI星盘报告结构解析失败: actions/,
        );
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        warnings: [{ title: "不要把沉默理解为拒绝", detail: "" }, validPayload.warnings[1]],
                    }),
                }),
            /AI星盘报告结构解析失败: warnings/,
        );
    });

    it("rejects actions and warnings that cannot be traced back to evidence", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        actions: [
                            { item: "直接做一次重大决定", reason: "宇宙能量正在推动改变。", timebox: "今天" },
                            validPayload.actions[1],
                            validPayload.actions[2],
                        ],
                    }),
                }),
            /AI星盘报告结构解析失败: actions\.0\.reason/,
        );
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        warnings: [
                            { title: "避免突然远行", detail: "未说明的外部变化会影响你的安排。" },
                            validPayload.warnings[1],
                        ],
                    }),
                }),
            /AI星盘报告结构解析失败: warnings\.0\.detail/,
        );
    });

    it("rejects report sections that do not cover insight, opportunity, risk, and action", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        sections: [
                            { heading: "洞察", content: "当前更适合看清对方反馈。" },
                            { heading: "整体建议", content: "先保持稳定。" },
                            { heading: "节奏", content: "不要急着推进。" },
                            { heading: "提醒", content: "多观察。" },
                        ],
                    }),
                }),
            /AI星盘报告结构解析失败: sections/,
        );
    });

    it("rejects follow-up prompts that are not actionable questions or continuation requests", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        followUps: ["继续努力保持觉察。", "一切都会越来越好。"],
                    }),
                }),
            /AI星盘报告结构解析失败: followUps/,
        );
    });

    it("rejects evidence sources that are not grounded in allowed generation context", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        evidence: [
                            { source: "未提供的星体相位", insight: "模型声称某个相位带来关系压力。", confidence: "medium" },
                            validPayload.evidence[1],
                        ],
                        reviewChecklist: [
                            validPayload.reviewChecklist[0],
                            validPayload.reviewChecklist[1],
                        ],
                    }),
                }),
            /evidence\.0\.source/,
        );
    });

    it("requires confidence on every evidence item so users can judge AI certainty", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        evidence: [
                            { source: "当前问题", insight: "用户给出了未来一周的时间范围和沟通目标。" },
                            validPayload.evidence[1],
                        ],
                    }),
                }),
            /evidence\.0\.confidence/,
        );
    });

    it("rejects evidence sources that claim unavailable or guessed context even when they contain allowed words", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        evidence: [
                            { source: "未提供的用户档案", insight: "模型声称长期档案显示用户适合冒险。", confidence: "low" },
                            validPayload.evidence[1],
                        ],
                        reviewChecklist: [
                            {
                                item: "未来三天记录对方是否主动回应具体安排",
                                why: "这能验证关系节奏是否真的适合轻量推进",
                                evidenceSource: "关系状态",
                                timebox: "未来3天",
                            },
                            {
                                item: "先确认对方是否愿意约定短沟通窗口",
                                why: "行动建议能验证沟通是否能轻量推进",
                                evidenceSource: "沟通减少说明需要先确认对方节奏",
                                timebox: "下次沟通前",
                            },
                        ],
                    }),
                }),
            /evidence\.0\.source/,
        );
    });

    it("rejects deterministic promises in user-facing AI report content", () => {
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        summary: "这段关系本周必然复合，只要行动就保证成功。",
                    }),
                }),
            /summary/,
        );
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        actions: [
                            { ...validPayload.actions[0], item: "保证对方会主动回复", reason: "关系状态显示沟通减少，需要先确认对方节奏。" },
                            validPayload.actions[1],
                            validPayload.actions[2],
                        ],
                    }),
                }),
            /actions\.0\.item/,
        );
        assert.throws(
            () =>
                parseAstrologyReportAiResult({
                    text: JSON.stringify({
                        ...validPayload,
                        warnings: [
                            { ...validPayload.warnings[0], detail: "关系状态已经沟通减少，继续催促一定会导致分手。" },
                            validPayload.warnings[1],
                        ],
                    }),
                }),
            /warnings\.0\.detail/,
        );
    });

    it("reuses the extension SDK JSON parser for model text output", () => {
        const source = readFileSync(
            new URL("../src/api/modules/astrology-fortune/services/astrology-report-ai-result.ts", import.meta.url),
            "utf8",
        );

        assert.match(source, /@buildingai\/extension-sdk/);
        assert.match(source, /safeJsonParse/);
        assert.doesNotMatch(source, /JSON\.parse\(stripJsonFence/);
    });
});
