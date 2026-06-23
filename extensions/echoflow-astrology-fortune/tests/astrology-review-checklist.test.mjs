import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
    normalizeAstrologyReportAiResult,
    parseAstrologyReportAiResult,
} from "../src/api/modules/astrology-fortune/services/astrology-report-ai-result.ts";
import { buildAstrologyReportText } from "../src/api/modules/astrology-fortune/services/astrology-report-text.ts";

const payloadWithChecklist = {
    title: "本周关系节奏",
    summary: "适合先观察再推进，沟通要具体。",
    scores: { overall: 82 },
    keywords: ["观察", "沟通"],
    lucky: { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" },
    evidence: [
        { source: "当前问题", insight: "用户给出了未来一周的时间范围和沟通目标。", confidence: "high" },
        { source: "关系状态", insight: "沟通减少说明需要先确认对方节奏。", confidence: "medium" },
    ],
    sections: [
        { heading: "洞察", content: "当前更适合先确认节奏，再决定是否推进。" },
        { heading: "机会", content: "具体而轻量的问题能让对方更容易回应。" },
        { heading: "风险", content: "不要把短期沉默直接理解为关系降温。" },
        { heading: "行动", content: "先用一个明确问题开启下次沟通。" },
    ],
    actions: [
        { item: "记录对方回应节奏", reason: "验证关系节奏是否适合轻量推进", timebox: "未来3天" },
        { item: "把沟通目标压缩成一个问题", reason: "降低对方理解和回应成本", timebox: "下次沟通前" },
        { item: "先约短沟通窗口", reason: "避免一次沟通承载过多情绪", timebox: "未来24小时" },
    ],
    warnings: [
        { title: "避免情绪化催促", detail: "催促会让轻量沟通变成压力测试。" },
        { title: "不要把沉默理解为拒绝", detail: "沉默也可能只是对方节奏变慢，需要更多观察信号。" },
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
    followUps: ["未来三天应该重点看哪些信号？", "把这份建议改成可以直接发给对方的话。"],
};

describe("astrology AI review checklist", () => {
    it("requires and normalizes review checklist items from model output", () => {
        const parsed = parseAstrologyReportAiResult({ text: JSON.stringify(payloadWithChecklist) });
        const normalized = normalizeAstrologyReportAiResult(parsed);

        assert.deepEqual(normalized.reviewChecklist, payloadWithChecklist.reviewChecklist);
        assert.throws(
            () => parseAstrologyReportAiResult({ text: JSON.stringify({ ...payloadWithChecklist, reviewChecklist: [] }) }),
            /AI星盘报告结构解析失败/,
        );
    });

    it("keeps review checklist in copied and downloaded report text", () => {
        const text = buildAstrologyReportText(normalizeAstrologyReportAiResult(payloadWithChecklist));

        assert.match(text, /## 复盘清单/);
        assert.match(text, /- \[未来3天\] 未来三天记录对方是否主动回应具体安排/);
        assert.match(text, /依据：关系状态；验证点：这能验证关系节奏是否真的适合轻量推进/);
        assert.match(text, /- 记录对方回应节奏 · 验证关系节奏是否适合轻量推进 · 未来3天/);
        assert.match(text, /- 避免情绪化催促 · 催促会让轻量沟通变成压力测试。/);
        assert.doesNotMatch(text, /\[object Object\]/);
    });

    it("renders review checklist in the user report consumption surface", () => {
        const pageSource = readFileSync(
            new URL("../src/web/pages/index.tsx", import.meta.url),
            "utf8",
        );

        assert.match(pageSource, /function ReviewChecklistPanel/);
        assert.match(pageSource, /result\.reviewChecklist \?\? \[\]/);
        assert.match(pageSource, /复盘清单/);
        assert.match(pageSource, /evidenceSource/);
        assert.match(pageSource, /timebox/);
    });

    it("previews the review checklist as a first-screen AI report structure before generation", () => {
        const pageSource = readFileSync(
            new URL("../src/web/pages/index.tsx", import.meta.url),
            "utf8",
        );

        assert.match(pageSource, /还没有可展示的报告/);
        assert.match(pageSource, /提交生成后，这里会展示 AI 摘要、判断依据、复盘清单、行动建议、观察信号和继续追问入口。/);
        assert.match(pageSource, /"复盘清单"/);
    });
});
