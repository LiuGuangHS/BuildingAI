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
        result: {
            summary: "今天适合先处理可控事项，再推进关系沟通。",
            scores: { overall: 88, mood: 76 },
            keywords: ["节奏", "沟通", "观察"],
            lucky: { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" },
            evidence: [
                { source: "当前问题", insight: "用户明确了今日计划和关系沟通目标。", confidence: "high" },
                { source: "档案完整度", insight: "出生时间完整，适合给出更具体的节奏建议。", confidence: "medium" },
                { source: "近期状态", insight: "压力偏高，需要避免临时加码。", confidence: "medium" },
            ],
            reviewChecklist: [
                { item: "记录关系沟通后的真实反馈", why: "验证建议是否改善互动质量", evidenceSource: "当前问题", timebox: "未来3天" },
                { item: "观察临时任务是否明显增加", why: "验证压力管理建议是否需要调整", evidenceSource: "近期状态" },
                { item: "复盘今日优先事项完成度", why: "第三条不进入通知摘要", evidenceSource: "行动建议" },
            ],
            followUps: ["今天最适合先处理哪一件事？", "这份建议怎么转成沟通话术？", "哪些信号说明应该暂缓？"],
        },
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
            scores: { overall: 88, mood: 76 },
            keywords: ["节奏", "沟通", "观察"],
            lucky: { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" },
            summary: "今天适合先处理可控事项，再推进关系沟通。",
            evidence: [
                { source: "当前问题", insight: "用户明确了今日计划和关系沟通目标。", confidence: "high" },
                { source: "档案完整度", insight: "出生时间完整，适合给出更具体的节奏建议。", confidence: "medium" },
            ],
            reviewChecklist: [
                { item: "记录关系沟通后的真实反馈", why: "验证建议是否改善互动质量", evidenceSource: "当前问题", timebox: "未来3天" },
                { item: "观察临时任务是否明显增加", why: "验证压力管理建议是否需要调整", evidenceSource: "近期状态" },
            ],
            followUps: ["今天最适合先处理哪一件事？", "这份建议怎么转成沟通话术？"],
        });
    });

    it("keeps successful notification AI summary compact and public-only", () => {
        const notification = buildAstrologyReportSucceededNotification(
            report({
                result: {
                    summary: "  ".repeat(20) + "这一段很长".repeat(80),
                    scores: { overall: 88, mood: "bad", rawProvider: "hidden" },
                    keywords: ["  节奏  ", "", "沟通", "观察", "第三个会被截断"],
                    lucky: {
                        color: "  蓝色  ",
                        number: 6,
                        direction: "  东南  ",
                        timeRange: "  19:00-21:00  ",
                        rawResponse: { hidden: true },
                    },
                    evidence: [
                        { source: "  当前问题  ", insight: "  用户希望判断是否该主动沟通。  ", confidence: "high", rawProvider: "hidden" },
                        { source: "", insight: "这条应该被过滤" },
                        { source: "关系状态", insight: "双方沟通频率下降。", rawResponse: { hidden: true } },
                        { source: "用户反馈", insight: "用户反馈上一份报告的行动建议可执行。", confidence: "medium" },
                    ],
                    reviewChecklist: [
                        {
                            item: "  记录对方是否主动回应  ",
                            why: "  验证互动节奏是否回暖  ",
                            evidenceSource: "  关系状态  ",
                            timebox: "未来3天",
                            rawProvider: "hidden",
                        },
                        { item: "", why: "这条应该被过滤", evidenceSource: "当前问题" },
                        { item: "写一段低压力消息", why: "看回复是否变得具体", evidenceSource: "行动建议", rawResponse: { hidden: true } },
                        { item: "第三条会被截断", why: "不会进入通知摘要", evidenceSource: "风险提醒" },
                    ],
                    followUps: ["  接下来三天看什么信号？  ", "", "如何写成一段消息？", "第三条会被截断"],
                    rawResponse: { hidden: true },
                },
            }),
        );

        assert.equal(notification.data.summary.length <= 160, true);
        assert.deepEqual(notification.data.scores, { overall: 88 });
        assert.deepEqual(notification.data.keywords, ["节奏", "沟通", "观察"]);
        assert.deepEqual(notification.data.lucky, { color: "蓝色", number: 6, direction: "东南", timeRange: "19:00-21:00" });
        assert.deepEqual(notification.data.evidence, [
            { source: "当前问题", insight: "用户希望判断是否该主动沟通。", confidence: "high" },
            { source: "用户反馈", insight: "用户反馈上一份报告的行动建议可执行。", confidence: "medium" },
        ]);
        assert.deepEqual(notification.data.reviewChecklist, [
            { item: "记录对方是否主动回应", why: "验证互动节奏是否回暖", evidenceSource: "关系状态", timebox: "未来3天" },
            { item: "写一段低压力消息", why: "看回复是否变得具体", evidenceSource: "行动建议" },
        ]);
        assert.deepEqual(notification.data.followUps, ["接下来三天看什么信号？", "如何写成一段消息？"]);
        assert.equal("rawResponse" in notification.data, false);
        assert.equal("rawProvider" in notification.data.scores, false);
        assert.equal("rawResponse" in notification.data.lucky, false);
        assert.equal("rawProvider" in notification.data.evidence[0], false);
        assert.equal("rawProvider" in notification.data.reviewChecklist[0], false);
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
