import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    hasAstrologyReportRequestKey,
    shouldReturnExistingAstrologyReport,
} from "../src/api/modules/astrology-fortune/services/astrology-report-idempotency.ts";
import {
    canRefundAstrologyReport,
    canTransitionAstrologyReportToFailed,
    shouldNotifyAstrologyReport,
} from "../src/api/modules/astrology-fortune/services/astrology-report-billing-rules.ts";

const requestKey = "00000000-0000-4000-8000-000000000001";

describe("astrology report request idempotency", () => {
    it("accepts only UUID v4 request keys with the fixed length", () => {
        assert.equal(hasAstrologyReportRequestKey(requestKey), true);
        assert.equal(hasAstrologyReportRequestKey(""), false);
        assert.equal(hasAstrologyReportRequestKey("   "), false);
        assert.equal(hasAstrologyReportRequestKey("00000000-0000-3000-8000-000000000001"), false);
        assert.equal(hasAstrologyReportRequestKey("00000000-0000-4000-8000-00000000000"), false);
        assert.equal(hasAstrologyReportRequestKey(null), false);
    });

    it("returns an existing active report only for the same user and request key", () => {
        assert.equal(
            shouldReturnExistingAstrologyReport({ id: "report-1", userId: "user-1", requestKey }, "user-1", requestKey),
            true,
        );
        assert.equal(
            shouldReturnExistingAstrologyReport({ id: "report-1", userId: "user-2", requestKey }, "user-1", requestKey),
            false,
        );
        assert.equal(
            shouldReturnExistingAstrologyReport({ id: "report-1", userId: "user-1", requestKey: null }, "user-1", requestKey),
            false,
        );
    });
});

describe("astrology report terminal billing rules", () => {
    it("claims failure before refund and never refunds a successful report", () => {
        assert.equal(canTransitionAstrologyReportToFailed("pending"), true);
        assert.equal(canTransitionAstrologyReportToFailed("processing"), true);
        assert.equal(canTransitionAstrologyReportToFailed("success"), false);
        assert.equal(canTransitionAstrologyReportToFailed("failed"), false);

        assert.equal(
            canRefundAstrologyReport({ status: "failed", billingStatus: "deducted", hasDeductionLog: true }),
            true,
        );
        assert.equal(
            canRefundAstrologyReport({ status: "failed", billingStatus: "refunded", hasDeductionLog: true }),
            false,
        );
        assert.equal(
            canRefundAstrologyReport({ status: "success", billingStatus: "deducted", hasDeductionLog: true }),
            false,
        );
        assert.equal(
            canRefundAstrologyReport({ status: "processing", billingStatus: "deducted", hasDeductionLog: true }),
            false,
        );
    });

    it("allows one terminal notification and suppresses duplicates", () => {
        assert.equal(shouldNotifyAstrologyReport({ status: "success" }), true);
        assert.equal(shouldNotifyAstrologyReport({ status: "failed" }), true);
        assert.equal(shouldNotifyAstrologyReport({ status: "processing" }), false);
        assert.equal(shouldNotifyAstrologyReport({ status: "failed", notificationSentAt: "2026-08-09T00:00:00.000Z" }), false);
    });
});
