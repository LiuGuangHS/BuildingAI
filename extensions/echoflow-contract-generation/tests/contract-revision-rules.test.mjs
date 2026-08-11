import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const rules = await import("../src/api/modules/contract-generation/services/contract-revision-rules.ts");
const serviceSource = readFileSync(
    new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url),
    "utf8",
);
const dtoSource = readFileSync(new URL("../src/api/modules/contract-generation/dto/contract-generation.dto.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../src/api/db/migrations/1781539200002-0.0.1-add-contract-task-revision.ts", import.meta.url), "utf8");

function applyWrite(currentRevision, baseRevision) {
    assert.equal(rules.isCurrentContractRevision(baseRevision, currentRevision), true);
    return rules.nextContractRevision(currentRevision);
}

test("rejects a stale base revision", () => {
    assert.equal(rules.isCurrentContractRevision(2, 3), false);
});

test("allows exactly one write for the same base revision", () => {
    const savedRevision = applyWrite(5, 5);

    assert.equal(rules.isCurrentContractRevision(5, savedRevision), false);
});

test("increments revision for save, risk acceptance, and version restore", () => {
    const savedRevision = applyWrite(0, 0);
    const acceptedRevision = applyWrite(savedRevision, savedRevision);
    const restoredRevision = applyWrite(acceptedRevision, acceptedRevision);

    assert.equal(restoredRevision, 3);
});

test("editing an exported contract returns it to draft while incrementing revision", () => {
    const savedRevision = applyWrite(7, 7);
    const nextStatus = "success" === "success" ? "draft" : "success";

    assert.deepEqual({ revision: savedRevision, status: nextStatus }, { revision: 8, status: "draft" });
});

test("revision DTOs preserve blank values for validation instead of coercing them to zero", () => {
    assert.equal((dtoSource.match(/baseRevision: number;/g) ?? []).length, 3);
    assert.match(dtoSource, /value == null \|\| \(typeof value === "string" && value\.trim\(\) === ""\)/);
});

test("revision migration appends the fencing token without changing the initial migration", () => {
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS "revision" int NOT NULL DEFAULT 0/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS "processing_attempt_id" varchar\(80\)/);
});

test("successful task writes increment revision before creating their versions", () => {
    for (const [method, versionType] of [["executeGenerateTask", "generate"], ["executeReviewUploadTask", "upload_review"], ["reviewTask", "review"]]) {
        const match = serviceSource.match(new RegExp(`(?:private )?async ${method}[\\s\\S]*?(?=\\n    (?:private )?async |\\n    private |$)`));
        assert.ok(match, `${method} should exist`);
        assert.match(match[0], /(?:revision: nextContractRevision\(currentTask\.revision\)|const nextRevision = nextContractRevision\(currentTask\.revision\)[\s\S]*?revision: nextRevision)/);
        assert.match(match[0], new RegExp(`createVersion\\(saved, "${versionType}"`));
    }
});

test("all editable write paths compare the base revision under the existing transaction lock", () => {
    for (const method of ["updateTaskContent", "updateRiskAction", "restoreTaskVersion"]) {
        const match = serviceSource.match(new RegExp(`async ${method}[\\s\\S]*?(?=\\n    async |\\n    private |\\n    public |$)`));
        assert.ok(match, `${method} should exist`);
        assert.match(match[0], /findActiveTaskForWrite\(task\.id, entityManager\)/);
        assert.match(match[0], /this\.assertTaskEditable\(currentTask\)/);
        assert.match(match[0], /isCurrentContractRevision\(dto\.baseRevision, currentTask\.revision\)/);
        assert.match(match[0], /HttpErrorFactory\.conflict/);
        assert.match(match[0], /(?:revision: nextContractRevision\(currentTask\.revision\)|const nextRevision = nextContractRevision\(currentTask\.revision\)[\s\S]*?revision: nextRevision)/);
    }
});
