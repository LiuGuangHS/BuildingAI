import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    ASTROLOGY_REPORT_FAILED_SCENE,
    ASTROLOGY_REPORT_LINK_URL,
    ASTROLOGY_REPORT_SUCCEEDED_SCENE,
    buildAstrologyReportFailedNotification,
    buildAstrologyReportSucceededNotification,
    getAstrologyReportDisplayName,
} from "../src/api/modules/astrology-fortune/services/astrology-report-notification-rules.ts";

function report(overrides = {}) {
    return {
        id: "report-1",
        userId: "user-1",
        reportType: "daily",
        score: 88,
        tags: ["今日"],
        providerMetadata: {},
        ...overrides,
    };
}

describe("astrology report notification rules", () => {
    it("keeps terminal notifications traceable to a report source", () => {
        const notification = buildAstrologyReportSucceededNotification(report());

        assert.equal("extensionId" in notification, false);
        assert.equal(notification.sceneCode, ASTROLOGY_REPORT_SUCCEEDED_SCENE);
        assert.equal(notification.linkUrl, ASTROLOGY_REPORT_LINK_URL);
        assert.equal(notification.sourceType, "report");
        assert.equal(notification.sourceId, "report-1");
        assert.equal(notification.level, "success");
        assert.deepEqual(notification.data, {
            taskName: "每日运势报告",
            reportType: "daily",
            score: 88,
            tags: ["今日"],
        });
    });

    it("includes refund metadata in failed notifications without exposing provider raw data", () => {
        const notification = buildAstrologyReportFailedNotification(
            report({
                reportType: "compatibility",
                providerMetadata: {
                    billingStatus: "refunded",
                    refundedAt: "2026-06-19T10:00:00.000Z",
                    refundError: "refund pending",
                    rawResponse: { hidden: true },
                },
            }),
            "模型暂不可用",
        );

        assert.equal(notification.sceneCode, ASTROLOGY_REPORT_FAILED_SCENE);
        assert.equal(notification.level, "error");
        assert.deepEqual(notification.data, {
            taskName: "关系合盘报告",
            reportType: "compatibility",
            reason: "模型暂不可用",
            billingStatus: "refunded",
            refundedAt: "2026-06-19T10:00:00.000Z",
            refundError: "refund pending",
        });
        assert.equal("rawResponse" in notification.data, false);
    });

    it("normalizes empty failure messages and report type names", () => {
        const notification = buildAstrologyReportFailedNotification(report({ reportType: "unknown" }), "");

        assert.equal(notification.data.taskName, "星盘运势报告");
        assert.equal(notification.data.reason, "请稍后重试或联系管理员");
        assert.equal(getAstrologyReportDisplayName("weekly"), "每周运势报告");
        assert.equal(getAstrologyReportDisplayName("monthly"), "每月运势报告");
        assert.equal(getAstrologyReportDisplayName("love"), "情感运势报告");
        assert.equal(getAstrologyReportDisplayName("career"), "事业运势报告");
        assert.equal(getAstrologyReportDisplayName("wealth"), "财富运势报告");
        assert.equal(getAstrologyReportDisplayName("relationship"), "关系洞察报告");
    });
});
