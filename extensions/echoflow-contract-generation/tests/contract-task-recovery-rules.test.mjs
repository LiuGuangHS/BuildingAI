import assert from "node:assert/strict";
import { test } from "node:test";

const rules = await import("../src/api/modules/contract-generation/services/contract-task-recovery-rules.ts");

const nowMs = Date.parse("2026-06-19T09:00:00.000Z");
const cutoff = new Date(nowMs - 30 * 60 * 1000);

function task(overrides = {}) {
    return {
        status: "processing",
        updatedAt: new Date(nowMs - 31 * 60 * 1000),
        requestPayload: { prompt: "起草服务合同" },
        providerMetadata: { jobType: rules.CONTRACT_TASK_RECOVERABLE_JOB.GENERATE },
        deletedAt: null,
        ...overrides,
    };
}

test("resolveContractTaskJobName only allows known queue job types", () => {
    assert.deepEqual(rules.CONTRACT_TASK_RECOVERABLE_JOB, {
        GENERATE: "generate_contract",
        REVIEW_UPLOAD: "review_upload",
    });
    assert.equal(rules.resolveContractTaskJobName(task()), rules.CONTRACT_TASK_RECOVERABLE_JOB.GENERATE);
    assert.equal(
        rules.resolveContractTaskJobName(task({ providerMetadata: { jobType: rules.CONTRACT_TASK_RECOVERABLE_JOB.REVIEW_UPLOAD } })),
        rules.CONTRACT_TASK_RECOVERABLE_JOB.REVIEW_UPLOAD,
    );
    assert.equal(rules.resolveContractTaskJobName(task({ providerMetadata: { jobType: "reserved" } })), null);
    assert.equal(rules.resolveContractTaskJobName(task({ providerMetadata: {} })), null);
});

test("canRecoverContractTask recovers only old recoverable tasks with payload and known job", () => {
    assert.equal(rules.canRecoverContractTask(task(), cutoff, nowMs), true);
    assert.equal(rules.canRecoverContractTask(task({ status: "draft" }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ status: "reviewing" }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ status: "exporting" }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ requestPayload: null }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ updatedAt: new Date(nowMs - 5 * 60 * 1000) }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ deletedAt: new Date(nowMs - 60_000) }), cutoff, nowMs), false);
    assert.equal(rules.canRecoverContractTask(task({ providerMetadata: { jobType: "unknown" } }), cutoff, nowMs), false);
});

test("contract busy statuses include interactive review and export", () => {
    assert.equal(rules.isContractTaskBusyStatus("pending"), true);
    assert.equal(rules.isContractTaskBusyStatus("processing"), true);
    assert.equal(rules.isContractTaskBusyStatus("reviewing"), true);
    assert.equal(rules.isContractTaskBusyStatus("exporting"), true);
    assert.equal(rules.isContractTaskBusyStatus("draft"), false);
});

test("stale interactive tasks resolve to retryable states", () => {
    assert.deepEqual(rules.resolveStaleContractTaskResolution("reviewing"), {
        status: "draft",
        errorKey: "lastReviewError",
        message: "合同审查任务超时，请重新发起审查",
    });
    assert.deepEqual(rules.resolveStaleContractTaskResolution("exporting"), {
        status: "export_failed",
        errorKey: "lastExportError",
        message: "合同导出任务超时，请重新导出",
    });
    assert.deepEqual(rules.resolveStaleContractTaskResolution("processing"), {
        status: "failed",
        errorKey: "timeoutError",
        message: "合同生成任务超时，请重新提交",
    });
    assert.equal(rules.resolveStaleContractTaskResolution("draft"), null);
});

test("canRecoverContractTask respects recent recovery locks", () => {
    assert.equal(
        rules.canRecoverContractTask(
            task({ providerMetadata: { jobType: rules.CONTRACT_TASK_RECOVERABLE_JOB.GENERATE, recoveryLockedAt: new Date(nowMs - 60_000).toISOString() } }),
            cutoff,
            nowMs,
        ),
        false,
    );
    assert.equal(
        rules.canRecoverContractTask(
            task({ providerMetadata: { jobType: rules.CONTRACT_TASK_RECOVERABLE_JOB.GENERATE, recoveryLockedAt: new Date(nowMs - 10 * 60_000).toISOString() } }),
            cutoff,
            nowMs,
        ),
        true,
    );
});

test("canClaimContractTaskForProcessing avoids busy processing records with fresh locks", () => {
    assert.equal(rules.canClaimContractTaskForProcessing(task({ status: "pending" }), nowMs), true);
    assert.equal(rules.canClaimContractTaskForProcessing(task({ status: "reviewing" }), nowMs), false);
    assert.equal(rules.canClaimContractTaskForProcessing(task({ status: "exporting" }), nowMs), false);
    // 1 minute old: within 30-min processing lock → blocked
    assert.equal(
        rules.canClaimContractTaskForProcessing(
            task({ providerMetadata: { processingLockedAt: new Date(nowMs - 60_000).toISOString() } }),
            nowMs,
        ),
        false,
    );
    // 10 minutes old: still within 30-min processing lock → blocked
    assert.equal(
        rules.canClaimContractTaskForProcessing(
            task({ providerMetadata: { processingLockedAt: new Date(nowMs - 10 * 60_000).toISOString() } }),
            nowMs,
        ),
        false,
    );
    assert.equal(rules.canClaimContractTaskForProcessing(task({ status: "success" }), nowMs), false);
});

test("processing lock timeout is 30 minutes, not affected by 5-minute recovery lock", () => {
    assert.equal(rules.CONTRACT_TASK_PROCESSING_LOCK_MS, 30 * 60 * 1000);
    assert.equal(rules.CONTRACT_TASK_RECOVERY_LOCK_MS, 5 * 60 * 1000);
    // 25 minutes old: still within processing lock → blocked
    assert.equal(
        rules.canClaimContractTaskForProcessing(
            task({ providerMetadata: { processingLockedAt: new Date(nowMs - 25 * 60_000).toISOString() } }),
            nowMs,
        ),
        false,
    );
    // 35 minutes old: exceeds processing lock → allowed
    assert.equal(
        rules.canClaimContractTaskForProcessing(
            task({ providerMetadata: { processingLockedAt: new Date(nowMs - 35 * 60_000).toISOString() } }),
            nowMs,
        ),
        true,
    );
});
