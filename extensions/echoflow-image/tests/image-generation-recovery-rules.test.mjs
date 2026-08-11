import assert from "node:assert/strict";
import { test } from "node:test";

const rules = await import("../src/api/modules/generation/services/image-generation-recovery-rules.ts");

const nowMs = Date.parse("2026-06-19T09:00:00.000Z");

function generation(overrides = {}) {
    return {
        status: "pending",
        updatedAt: new Date(nowMs - 3 * 60 * 1000),
        progress: 30,
        deletedAt: null,
        ...overrides,
    };
}

test("shouldResumeImageGeneration resumes only old pending records", () => {
    assert.equal(rules.shouldResumeImageGeneration(generation(), nowMs), true);
    assert.equal(rules.shouldResumeImageGeneration(generation({ updatedAt: new Date(nowMs - 30_000) }), nowMs), false);
    assert.equal(rules.shouldResumeImageGeneration(generation({ status: "processing" }), nowMs), false);
    assert.equal(rules.shouldResumeImageGeneration(generation({ status: "succeeded" }), nowMs), false);
    assert.equal(rules.shouldResumeImageGeneration(generation({ deletedAt: new Date(nowMs - 10_000) }), nowMs), false);
});

test("shouldTimeoutImageGeneration times out only stale processing records", () => {
    assert.equal(
        rules.shouldTimeoutImageGeneration(generation({ status: "processing", updatedAt: new Date(nowMs - 31 * 60 * 1000) }), nowMs),
        true,
    );
    assert.equal(
        rules.shouldTimeoutImageGeneration(generation({ status: "processing", updatedAt: new Date(nowMs - 5 * 60 * 1000) }), nowMs),
        false,
    );
    assert.equal(rules.shouldTimeoutImageGeneration(generation({ status: "pending" }), nowMs), false);
    assert.equal(rules.shouldTimeoutImageGeneration(generation({ status: "failed" }), nowMs), false);
});

test("getResumedImageProgress never increases progress above the resume cap", () => {
    assert.equal(rules.getResumedImageProgress(undefined), 0);
    assert.equal(rules.getResumedImageProgress(3), 3);
    assert.equal(rules.getResumedImageProgress(10), 10);
    assert.equal(rules.getResumedImageProgress(80), 10);
});

test("isImageGenerationTerminalStatus identifies terminal generation states", () => {
    assert.equal(rules.isImageGenerationTerminalStatus("succeeded"), true);
    assert.equal(rules.isImageGenerationTerminalStatus("failed"), true);
    assert.equal(rules.isImageGenerationTerminalStatus("pending"), false);
    assert.equal(rules.isImageGenerationTerminalStatus("processing"), false);
});

test("canRetryImageGeneration permits only failed tasks with settled billing", () => {
    assert.equal(rules.canRetryImageGeneration("pending", "pending"), false);
    assert.equal(rules.canRetryImageGeneration("processing", "deducted"), false);
    assert.equal(rules.canRetryImageGeneration("succeeded", "refunded"), false);
    assert.equal(rules.canRetryImageGeneration("failed", "pending"), false);
    assert.equal(rules.canRetryImageGeneration("failed", "failed"), true);
    assert.equal(rules.canRetryImageGeneration("failed", "deducted"), false);
    assert.equal(rules.canRetryImageGeneration("failed", "refunded"), true);
});

test("canFailImageGeneration preserves terminal tasks", () => {
    assert.equal(rules.canFailImageGeneration("pending"), true);
    assert.equal(rules.canFailImageGeneration("processing"), true);
    assert.equal(rules.canFailImageGeneration("succeeded"), false);
    assert.equal(rules.canFailImageGeneration("failed"), false);
});

test("canCompleteImageGeneration requires processing status and a registered file", () => {
    assert.equal(rules.canCompleteImageGeneration("pending", [{ fileId: "file-a" }]), false);
    assert.equal(rules.canCompleteImageGeneration("processing", []), false);
    assert.equal(rules.canCompleteImageGeneration("processing", [{ mimeType: "image/png" }]), false);
    assert.equal(rules.canCompleteImageGeneration("processing", [{ fileId: "file-a" }]), true);
});
