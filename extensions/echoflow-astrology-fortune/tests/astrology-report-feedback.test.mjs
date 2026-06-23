import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAstrologyReportFeedbackMetadata } from "../src/api/modules/astrology-fortune/services/astrology-report-feedback.ts";

describe("astrology report feedback metadata", () => {
    it("stores only the public feedback fields and keeps existing metadata", () => {
        const metadata = buildAstrologyReportFeedbackMetadata(
            {
                provider: "openai",
                model: "gpt-test",
                billingStatus: "deducted",
            },
            {
                rating: "useful",
                note: "  行动建议很具体  ",
                extra: "should be ignored",
            },
            "2026-06-20T00:00:00.000Z",
        );

        assert.deepEqual(metadata, {
            provider: "openai",
            model: "gpt-test",
            billingStatus: "deducted",
            feedback: {
                rating: "useful",
                note: "行动建议很具体",
                updatedAt: "2026-06-20T00:00:00.000Z",
            },
        });
    });

    it("omits blank notes instead of persisting empty text", () => {
        const metadata = buildAstrologyReportFeedbackMetadata(null, { rating: "too_generic", note: "   " }, "2026-06-20T00:00:00.000Z");

        assert.deepEqual(metadata, {
            feedback: {
                rating: "too_generic",
                updatedAt: "2026-06-20T00:00:00.000Z",
            },
        });
        assert.equal("note" in metadata.feedback, false);
    });
});
