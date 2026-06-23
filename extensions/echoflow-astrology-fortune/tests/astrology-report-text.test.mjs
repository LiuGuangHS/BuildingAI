import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAstrologyReportText } from "../src/api/modules/astrology-fortune/services/astrology-report-text.ts";

describe("astrology report text output", () => {
    it("keeps evidence and follow-up prompts in copied or exported report text", () => {
        const text = buildAstrologyReportText({
            title: "本周关系节奏",
            summary: "适合先观察再推进，沟通要具体。",
            scores: { overall: 82, love: 78 },
            keywords: ["观察", "沟通"],
            lucky: { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" },
            evidence: [
                {
                    source: "当前问题",
                    insight: "用户给出了未来一周的时间范围和沟通目标。",
                    confidence: "high",
                },
                {
                    source: "关系状态",
                    insight: "沟通减少说明需要先确认对方节奏。",
                    confidence: "medium",
                },
            ],
            sections: [{ heading: "洞察", content: "当前更适合看清对方反馈。" }],
            actions: [
                {
                    item: "先确认对方时间",
                    reason: "减少沟通压力",
                    timebox: "未来24小时",
                },
            ],
            warnings: [
                {
                    title: "不要把沉默理解为拒绝",
                    detail: "沉默也可能只是对方节奏变慢，需要更多观察信号。",
                },
            ],
            followUps: ["未来三天应该重点看哪些信号？", "把这份建议改成可以直接发给对方的话。"],
            closing: "把直觉变成行动前，先给事实一点时间。",
        });

        assert.match(text, /## 评分/);
        assert.match(text, /- 整体：82%/);
        assert.match(text, /- 爱情：78%/);
        assert.match(text, /## 判断依据/);
        assert.match(text, /当前问题（高可信）：用户给出了未来一周的时间范围和沟通目标。/);
        assert.match(text, /关系状态（中可信）：沟通减少说明需要先确认对方节奏。/);
        assert.match(text, /## 幸运锚点/);
        assert.match(text, /- 幸运色：蓝色/);
        assert.match(text, /- 幸运数字：6/);
        assert.match(text, /- 方位：东南/);
        assert.match(text, /- 时间段：19:00-21:00/);
        assert.match(text, /## 行动建议/);
        assert.match(text, /- 先确认对方时间 · 减少沟通压力 · 未来24小时/);
        assert.match(text, /## 风险提醒/);
        assert.match(text, /- 不要把沉默理解为拒绝 · 沉默也可能只是对方节奏变慢，需要更多观察信号。/);
        assert.doesNotMatch(text, /\[object Object\]/);
        assert.match(text, /## 继续追问/);
        assert.match(text, /- 未来三天应该重点看哪些信号？/);
        assert.match(text, /- 把这份建议改成可以直接发给对方的话。/);
    });
});
