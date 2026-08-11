import assert from "node:assert/strict";
import { test } from "node:test";

import {
    VIDEO_PENDING_RESUME_AFTER_MS,
    VIDEO_PROCESSING_TIMEOUT_MS,
    canCompleteVideoGeneration,
    canFailVideoGeneration,
    canRetryVideoGeneration,
    getResumedVideoProgress,
    isVideoGenerationTerminalStatus,
    shouldResumeVideoGeneration,
    shouldTimeoutVideoGeneration,
} from "../src/api/modules/generation/services/video-generation-recovery-rules.ts";

const NOW = 2_000_000_000_000;

function snapshot(overrides = {}) {
    return {
        status: "processing",
        updatedAt: new Date(NOW - VIDEO_PROCESSING_TIMEOUT_MS),
        ...overrides,
    };
}

test("recognizes only succeeded and failed as terminal statuses", () => {
    assert.equal(isVideoGenerationTerminalStatus("pending"), false);
    assert.equal(isVideoGenerationTerminalStatus("processing"), false);
    assert.equal(isVideoGenerationTerminalStatus("succeeded"), true);
    assert.equal(isVideoGenerationTerminalStatus("failed"), true);
});

test("allows failure only from non-terminal states", () => {
    assert.equal(canFailVideoGeneration("pending"), true);
    assert.equal(canFailVideoGeneration("processing"), true);
    assert.equal(canFailVideoGeneration("succeeded"), false);
    assert.equal(canFailVideoGeneration("failed"), false);
});

test("requires processing and a stored video before completion", () => {
    assert.equal(canCompleteVideoGeneration("processing", "/video.mp4"), true);
    assert.equal(canCompleteVideoGeneration("processing", ""), false);
    assert.equal(canCompleteVideoGeneration("pending", "/video.mp4"), false);
    assert.equal(canCompleteVideoGeneration("succeeded", "/video.mp4"), false);
});

test("allows retry only after a failed task has a settled failure billing state", () => {
    assert.equal(canRetryVideoGeneration("failed", "failed"), true);
    assert.equal(canRetryVideoGeneration("failed", "refunded"), true);
    assert.equal(canRetryVideoGeneration("failed", "deducted"), false);
    assert.equal(canRetryVideoGeneration("succeeded", "refunded"), false);
});

test("detects stale processing without timing out terminal or deleted tasks", () => {
    assert.equal(shouldTimeoutVideoGeneration(snapshot(), NOW), true);
    assert.equal(shouldTimeoutVideoGeneration(snapshot({ updatedAt: new Date(NOW - VIDEO_PROCESSING_TIMEOUT_MS + 1) }), NOW), false);
    assert.equal(shouldTimeoutVideoGeneration(snapshot({ status: "succeeded" }), NOW), false);
    assert.equal(shouldTimeoutVideoGeneration(snapshot({ deletedAt: new Date() }), NOW), false);
});

test("detects resumable pending tasks after the pending grace period", () => {
    const stale = new Date(NOW - VIDEO_PENDING_RESUME_AFTER_MS);
    assert.equal(shouldResumeVideoGeneration({ status: "pending", updatedAt: stale }, NOW), true);
    assert.equal(shouldResumeVideoGeneration({ status: "pending", updatedAt: new Date(NOW) }, NOW), false);
    assert.equal(shouldResumeVideoGeneration({ status: "processing", updatedAt: stale }, NOW), false);
});

test("caps recovered progress so a resumed task remains visibly pending", () => {
    assert.equal(getResumedVideoProgress(80), 10);
    assert.equal(getResumedVideoProgress(5), 5);
    assert.equal(getResumedVideoProgress(), 0);
});