import assert from "node:assert/strict";
import { test } from "node:test";

import {
    buildAstrologyQuestionQualityContext,
    summarizeAstrologyQuestionQuality,
} from "../src/shared/astrology-question-quality.ts";

test("scores concrete astrology questions higher than vague questions", () => {
    const concrete = buildAstrologyQuestionQualityContext({
        reportType: "decision",
        focusArea: "事业选择",
        currentState: "本周要决定是否继续推进一个新工作机会",
        question: "未来一周我应该如何判断这个工作机会是否值得继续投入？",
    });

    const vague = buildAstrologyQuestionQualityContext({
        reportType: "decision",
        focusArea: "综合",
        currentState: "",
        question: "怎么办",
    });

    assert.equal(concrete.level, "strong");
    assert.ok(concrete.score > vague.score);
    assert.ok(concrete.signals.some((item) => item.code === "time" && item.present));
    assert.ok(concrete.signals.some((item) => item.code === "goal" && item.present));
    assert.equal(vague.level, "weak");
    assert.ok(vague.suggestions.includes("补充具体场景"));
});

test("summarizes question quality as prompt-ready context without leaking raw private fields", () => {
    const context = buildAstrologyQuestionQualityContext({
        reportType: "love",
        focusArea: "关系沟通",
        currentState: "近期和对方沟通减少，想知道适不适合主动聊一次",
        question: "未来七天我应该主动沟通，还是先观察对方反应？",
    });

    const summary = summarizeAstrologyQuestionQuality(context);

    assert.match(summary, /问题质量: strong/);
    assert.match(summary, /得分:/);
    assert.match(summary, /已包含:/);
    assert.match(summary, /时间范围/);
    assert.doesNotMatch(summary, /undefined|null|secret|provider/i);
});
