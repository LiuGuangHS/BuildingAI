import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    ASTROLOGY_REPORT_BUSY_STATUSES,
    ASTROLOGY_REPORT_FAILED_STATUS,
    ASTROLOGY_REPORT_PENDING_STATUS,
    ASTROLOGY_REPORT_PROCESSING_STATUS,
    ASTROLOGY_REPORT_RECOVERY_LOCK_MS,
    ASTROLOGY_REPORT_STALE_PROCESSING_MS,
    canClaimAstrologyReportForProcessing,
    canRecoverAstrologyReport,
    isAstrologyReportBusyStatus,
    isAstrologyReportProcessingLockActive,
    isAstrologyReportRecoveryLockActive,
} from "../src/api/modules/astrology-fortune/services/astrology-report-recovery-rules.ts";

const nowMs = Date.parse("2026-06-19T10:00:00.000Z");
const cutoff = new Date(nowMs - ASTROLOGY_REPORT_STALE_PROCESSING_MS);
const oldEnough = new Date(cutoff.getTime() - 1);
const tooFresh = new Date(cutoff.getTime() + 1);

function report(overrides = {}) {
    return {
        status: ASTROLOGY_REPORT_PENDING_STATUS,
        updatedAt: oldEnough,
        deletedAt: null,
        providerMetadata: {},
        requestPayload: { reportType: "daily" },
        ...overrides,
    };
}

describe("astrology report recovery rules", () => {
    it("keeps the busy status set explicit", () => {
        assert.deepEqual(ASTROLOGY_REPORT_BUSY_STATUSES, [
            ASTROLOGY_REPORT_PENDING_STATUS,
            ASTROLOGY_REPORT_PROCESSING_STATUS,
        ]);
        assert.equal(isAstrologyReportBusyStatus(ASTROLOGY_REPORT_PENDING_STATUS), true);
        assert.equal(isAstrologyReportBusyStatus(ASTROLOGY_REPORT_PROCESSING_STATUS), true);
        assert.equal(isAstrologyReportBusyStatus(ASTROLOGY_REPORT_FAILED_STATUS), false);
    });

    it("recovers old pending or processing reports that still have a request payload", () => {
        assert.equal(canRecoverAstrologyReport(report(), cutoff, nowMs), true);
        assert.equal(canRecoverAstrologyReport(report({ status: ASTROLOGY_REPORT_PROCESSING_STATUS }), cutoff, nowMs), true);
    });

    it("does not recover terminal, fresh, payload-less, or soft-deleted reports", () => {
        assert.equal(canRecoverAstrologyReport(report({ status: ASTROLOGY_REPORT_FAILED_STATUS }), cutoff, nowMs), false);
        assert.equal(canRecoverAstrologyReport(report({ updatedAt: tooFresh }), cutoff, nowMs), false);
        assert.equal(canRecoverAstrologyReport(report({ requestPayload: null }), cutoff, nowMs), false);
        assert.equal(canRecoverAstrologyReport(report({ deletedAt: new Date(nowMs) }), cutoff, nowMs), false);
    });

    it("honors the recovery lock window", () => {
        const lockedAt = new Date(nowMs - ASTROLOGY_REPORT_RECOVERY_LOCK_MS + 1).toISOString();
        const expiredAt = new Date(nowMs - ASTROLOGY_REPORT_RECOVERY_LOCK_MS - 1).toISOString();

        assert.equal(isAstrologyReportRecoveryLockActive({ recoveryLockedAt: lockedAt }, nowMs), true);
        assert.equal(isAstrologyReportRecoveryLockActive({ recoveryLockedAt: expiredAt }, nowMs), false);
        assert.equal(canRecoverAstrologyReport(report({ providerMetadata: { recoveryLockedAt: lockedAt } }), cutoff, nowMs), false);
        assert.equal(canRecoverAstrologyReport(report({ providerMetadata: { recoveryLockedAt: expiredAt } }), cutoff, nowMs), true);
    });

    it("claims pending reports and skips processing reports that still hold a fresh lock", () => {
        const freshProcessingLock = new Date(nowMs - ASTROLOGY_REPORT_RECOVERY_LOCK_MS + 1).toISOString();
        const expiredProcessingLock = new Date(nowMs - ASTROLOGY_REPORT_RECOVERY_LOCK_MS - 1).toISOString();

        assert.equal(canClaimAstrologyReportForProcessing(report(), nowMs), true);
        assert.equal(isAstrologyReportProcessingLockActive({ processingLockedAt: freshProcessingLock }, nowMs), true);
        assert.equal(
            canClaimAstrologyReportForProcessing(
                report({
                    status: ASTROLOGY_REPORT_PROCESSING_STATUS,
                    providerMetadata: { processingLockedAt: freshProcessingLock },
                }),
                nowMs,
            ),
            false,
        );
        assert.equal(
            canClaimAstrologyReportForProcessing(
                report({
                    status: ASTROLOGY_REPORT_PROCESSING_STATUS,
                    providerMetadata: { processingLockedAt: expiredProcessingLock },
                }),
                nowMs,
            ),
            true,
        );
    });
});
