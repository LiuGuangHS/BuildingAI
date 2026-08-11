import assert from "node:assert/strict";
import { test } from "node:test";

const rules = await import("../src/api/modules/generation/services/image-generation-billing-rules.ts");
const recoveryRules = await import("../src/api/modules/generation/services/image-generation-recovery-rules.ts");

test("reservation admits only requests below the per-user active limit", () => {
    assert.equal(rules.canReserveImageGeneration(0, 1), true);
    assert.equal(rules.canReserveImageGeneration(1, 1), false);
    assert.equal(rules.canReserveImageGeneration(2, 1), false);
});

test("request idempotency requires a stable request key and returns the existing record before billing or provider checks", () => {
    assert.equal(rules.hasImageGenerationRequestKey(undefined), false);
    const requestKey = "00000000-0000-4000-8000-000000000001";
    assert.equal(rules.hasImageGenerationRequestKey(requestKey), true);
    assert.equal(
        rules.shouldReturnExistingImageGeneration({ id: "generation-1", userId: "user-1", requestKey }, "user-1", requestKey),
        true,
    );
    assert.equal(
        rules.shouldReturnExistingImageGeneration({ id: "generation-1", userId: "user-2", requestKey }, "user-1", requestKey),
        false,
    );
});

test("billing deduction is exactly once for a generation association", () => {
    assert.equal(rules.shouldDeductImageGeneration({ billingStatus: "pending", hasDeductionLog: false }), true);
    assert.equal(rules.shouldDeductImageGeneration({ billingStatus: "pending", hasDeductionLog: true }), false);
    assert.equal(rules.shouldDeductImageGeneration({ billingStatus: "deducted", hasDeductionLog: false }), false);
    assert.equal(rules.shouldDeductImageGeneration({ billingStatus: "refunded", hasDeductionLog: true }), false);
});

test("refund is required after a deduction and is exactly once", () => {
    assert.equal(rules.shouldRefundImageGeneration({ billingStatus: "deducted", hasDeductionLog: true, hasRefundLog: false }), true);
    assert.equal(rules.shouldRefundImageGeneration({ billingStatus: "pending", hasDeductionLog: true, hasRefundLog: false }), true);
    assert.equal(rules.shouldRefundImageGeneration({ billingStatus: "deducted", hasDeductionLog: true, hasRefundLog: true }), false);
    assert.equal(rules.shouldRefundImageGeneration({ billingStatus: "failed", hasDeductionLog: false, hasRefundLog: false }), false);
    assert.equal(rules.shouldRefundImageGeneration({ billingStatus: "refunded", hasDeductionLog: true, hasRefundLog: false }), false);
});

test("failed billing policy is persisted for recovery and refund failures have an audit timestamp", () => {
    assert.equal(rules.shouldRecoverImageRefund({ billingStatus: "deducted", refundRequired: true }), true);
    assert.equal(rules.shouldRecoverImageRefund({ billingStatus: "deducted", refundRequired: false }), false);
    assert.equal(rules.shouldRecoverImageRefund({ billingStatus: "deducted" }), false);
    assert.equal(rules.isImageRefundFailureTimestamp("2026-08-07T00:00:00.000Z"), true);
    assert.equal(rules.isImageRefundFailureTimestamp("退款记账失败"), false);
});

test("refund failure remains recoverable and retry requires settled billing", () => {
    assert.deepEqual(
        rules.resolveImageRefundFailure({ billingStatus: "deducted", refundError: "ledger unavailable" }),
        { billingStatus: "deducted", recoverable: true },
    );
    assert.equal(recoveryRules.canRetryImageGeneration("failed", "deducted"), false);
    assert.equal(recoveryRules.canRetryImageGeneration("failed", "failed"), true);
    assert.equal(recoveryRules.canRetryImageGeneration("failed", "refunded"), true);
});

test("retry key and payload are stable and copy only allowed business parameters", () => {
    const source = {
        id: "generation-1",
        prompt: "a cat",
        negativePrompt: "blur",
        modelId: "model-1",
        size: "1024x1024",
        n: 2,
        quality: "standard",
        style: "vivid",
        responseFormat: "b64_json",
        mode: "text-to-image",
        outputFormat: "png",
        background: "opaque",
        outputCompression: 80,
        inputFidelity: "high",
        moderation: "auto",
        seed: "42",
        rawRequest: { secret: "must-not-copy" },
        rawResponse: { providerTaskId: "must-not-copy" },
        storageFiles: [{ path: "must-not-copy" }],
    };
    const retryKey = rules.deriveImageRetryRequestKey(source.id);
    assert.equal(retryKey, rules.deriveImageRetryRequestKey(source.id));
    assert.deepEqual(rules.buildImageRetryPayload(source, retryKey), {
        prompt: "a cat",
        negativePrompt: "blur",
        modelId: "model-1",
        size: "1024x1024",
        n: 2,
        quality: "standard",
        style: "vivid",
        responseFormat: "b64_json",
        mode: "text-to-image",
        outputFormat: "png",
        background: "opaque",
        outputCompression: 80,
        inputFidelity: "high",
        moderation: "auto",
        seed: "42",
        requestKey: retryKey,
    });
});

test("reservation is held by pending recovery and released by terminal or deletion states", () => {
    assert.equal(rules.imageGenerationConsumesReservation("pending"), true);
    assert.equal(rules.imageGenerationConsumesReservation("processing"), true);
    assert.equal(rules.imageGenerationConsumesReservation("succeeded"), false);
    assert.equal(rules.imageGenerationConsumesReservation("failed"), false);
    assert.equal(rules.imageGenerationConsumesReservation("deleted"), false);
});

test("zero-amount failed tasks settle as failed without a refund", () => {
    assert.deepEqual(
        rules.resolveImageFailureBilling({ billingStatus: "deducted", billingAmount: 0, refundAllowed: true }),
        { billingStatus: "failed", refundRequired: false },
    );
});
