import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateAstrologyReportAiResultWithRepair } from "../src/api/modules/astrology-fortune/services/astrology-report-ai-retry.ts";

const validResult = { title: "可用报告" };

describe("astrology report AI repair retry", () => {
    it("retries once with a repair prompt when the first model output breaks the report schema", async () => {
        const prompts = [];
        const generation = await generateAstrologyReportAiResultWithRepair({
            basePrompt: "原始星盘报告提示词",
            generate: async (prompt) => {
                prompts.push(prompt);
                return prompts.length === 1 ? { text: "{\"title\":\"缺字段\"}" } : { output: validResult };
            },
            parse: (payload) => {
                if (payload === validResult || payload?.output === validResult) return validResult;
                throw new Error("AI星盘报告结构解析失败: scores, evidence, actions");
            },
        });

        assert.equal(generation.result, validResult);
        assert.deepEqual(generation.metadata, {
            aiRepairAttempted: true,
            aiRepairSucceeded: true,
            aiRepairReason: "AI星盘报告结构解析失败: scores, evidence, actions",
        });
        assert.equal(prompts.length, 2);
        assert.equal(prompts[0], "原始星盘报告提示词");
        assert.match(prompts[1], /上一次 AI 输出未通过结构校验/);
        assert.match(prompts[1], /只输出修复后的 JSON 对象/);
        assert.match(prompts[1], /scores, evidence, actions/);
        assert.doesNotMatch(prompts[1], /secret|apiKey|provider|baseURL/i);
    });

    it("does not retry ordinary provider failures", async () => {
        let attempts = 0;

        await assert.rejects(
            () =>
                generateAstrologyReportAiResultWithRepair({
                    basePrompt: "原始星盘报告提示词",
                    generate: async () => {
                        attempts += 1;
                        throw new Error("upstream timeout");
                    },
                    parse: () => validResult,
                }),
            /upstream timeout/,
        );

        assert.equal(attempts, 1);
    });
});
