import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
    "utf8",
);
const processorSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/processors/astrology-report.processor.ts", import.meta.url),
    "utf8",
);

function methodBody(name) {
    const start = serviceSource.search(new RegExp(`\\n    (private async |async )${name}\\(`));
    assert.notEqual(start, -1, `${name} should exist`);
    const nextPrivate = serviceSource.indexOf("\n    private async ", start + 1);
    const nextPublic = serviceSource.indexOf("\n    async ", start + 1);
    const next = [nextPrivate, nextPublic].filter((index) => index > start).sort((a, b) => a - b)[0];
    return serviceSource.slice(start, next === -1 ? undefined : next);
}

describe("astrology billing and refund boundary", () => {
    it("reserves report credits once using billing facts and the current transaction", () => {
        const body = methodBody("reserveReportCreditsOnce");

        assert.match(body, /Number\(report\.costCredits \?\? 0\)/);
        assert.match(body, /findActiveReportForWrite\(report\.id, entityManager, true\)/);
        assert.match(body, /providerMetadata\?\.billingStatus === "deducted"/);
        assert.match(body, /billingService\.hasBillingLog\(\{ associationNo: report\.id, action: ACTION\.DEC \}, entityManager\)/);
        assert.match(body, /billingService\.deductUserPower\(\{ userId: report\.userId, amount: cost/);
        assert.match(body, /associationNo: report\.id/);
        assert.match(body, /billingStatus: "deducted"/);
    });

    it("refunds only deducted unrefunded reports and records refund failure metadata", () => {
        const body = methodBody("refundReportCreditsIfNeeded");

        assert.match(body, /lock: \{ mode: "pessimistic_write" \}, withDeleted: true/);
        assert.match(body, /canRefundAstrologyReportCredits\(report\)/);
        assert.match(body, /metadata\.billingStatus === "deducted"/);
        assert.match(body, /billingService\.hasBillingLog\(\{ associationNo: report\.id, action: ACTION\.DEC \}, entityManager\)/);
        assert.match(body, /Boolean\(metadata\.refundedAt\)/);
        assert.match(body, /billingService\.hasBillingLog\(\{ associationNo: report\.id, action: ACTION\.INC \}, entityManager\)/);
        assert.match(body, /billingService\.addUserPower\(\{ userId: report\.userId, amount: Number\(report\.costCredits\)/);
        assert.match(body, /billingStatus: "refunded"/);
        assert.match(body, /refundedAt: new Date\(\)\.toISOString\(\)/);
        assert.match(body, /refundError: "退款记账失败"/);
        assert.match(body, /refundFailedAt: new Date\(\)\.toISOString\(\)/);
    });

    it("marks failure before attempting a refund so success cannot win after refund", () => {
        const processBody = methodBody("processReport");
        const taskCrashBody = methodBody("markReportCrashed");
        const staleFailureBody = methodBody("failStaleReports");

        for (const body of [processBody, taskCrashBody, staleFailureBody]) {
            const refundIndex = body.indexOf("await this.refundReportCreditsIfNeeded");
            const failIndex = body.indexOf("await this.markReportFailedIfActive");

            assert.ok(refundIndex >= 0, "failure path should attempt refund after terminal transition");
            assert.ok(failIndex >= 0, "failure path should mark report failed");
            assert.ok(failIndex < refundIndex, "failed terminal state must be committed before refund");
        }
    });

    it("classifies queue enqueue failures for console troubleshooting", () => {
        const enqueueBody = methodBody("enqueueReportJob");
        const crashBody = methodBody("markReportCrashed");

        assert.match(enqueueBody, /failureType: "queue_enqueue_failed"/);
        assert.match(enqueueBody, /failureReason: message/);
        assert.match(enqueueBody, /await this\.markReportCrashed\(id, new Error\("AI星盘运势任务队列暂不可用，请稍后重试"\), \{/);
        assert.match(crashBody, /metadata\?: Record<string, unknown>/);
        assert.match(crashBody, /const failedReport = await this\.markReportFailedIfActive\(reportId, "星盘报告生成失败/);
    });

    it("classifies worker crashes and stale timeout cleanup for console troubleshooting", () => {
        const staleFailureBody = methodBody("failStaleReports");

        assert.match(processorSource, /failureType: "worker_job_failed"/);
        assert.doesNotMatch(processorSource, /failureReason: error instanceof Error \? error\.message : String\(error\)/);
        assert.match(staleFailureBody, /failureType: "stale_report_timeout"/);
        assert.match(staleFailureBody, /failureReason: message/);
        assert.match(staleFailureBody, /const failedReport = await this\.markReportFailedIfActive\(report\.id, message, \{/);
        assert.match(staleFailureBody, /\}, cutoff\)/);
    });
});
