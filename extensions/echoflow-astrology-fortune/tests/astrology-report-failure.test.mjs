import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAstrologyReportFailure } from "../src/api/modules/astrology-fortune/services/astrology-report-failure.ts";

describe("astrology report failure metadata", () => {
    it("turns malformed AI output into a user-safe failure while preserving an operator reason", () => {
        const failure = buildAstrologyReportFailure(
            new Error("AI星盘报告结构解析失败: scores.overall"),
        );

        assert.equal(failure.message, "AI 返回的星盘报告格式异常，本次生成已失败并会按账务事实退款，请稍后重试。");
        assert.deepEqual(failure.metadata, {
            error: "AI 返回的星盘报告格式异常，本次生成已失败并会按账务事实退款，请稍后重试。",
            failureType: "ai_output_format",
            failureReason: "AI星盘报告结构解析失败: scores.overall",
        });
    });

    it("keeps ordinary provider errors user-safe while preserving the operator reason", () => {
        const failure = buildAstrologyReportFailure({ message: "upstream timeout" });

        assert.equal(failure.message, "星盘报告生成失败，本次生成已按账务事实处理，请稍后重试。");
        assert.deepEqual(failure.metadata, {
            error: "星盘报告生成失败，本次生成已按账务事实处理，请稍后重试。",
            failureType: "provider_error",
            failureReason: "upstream timeout",
        });
    });
});
