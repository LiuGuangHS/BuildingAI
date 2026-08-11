import assert from "node:assert/strict";
import { test } from "node:test";

const draft = await import("../src/web/components/contract-workbench/contract-draft-rules.ts");

test("draft payload keeps only contract editing data and base revision", () => {
    const payload = draft.createContractDraft({
        taskId: "task-1",
        templateId: "template-1",
        sections: [{ id: "scope", title: "服务范围", content: "正文" }],
        baseRevision: 4,
        savedAt: "2026-08-07T00:00:00.000Z",
    });

    assert.deepEqual(payload, {
        taskId: "task-1",
        templateId: "template-1",
        sections: [{ id: "scope", title: "服务范围", content: "正文" }],
        baseRevision: 4,
        savedAt: "2026-08-07T00:00:00.000Z",
    });
    assert.equal("provider" in payload, false);
    assert.equal("secret" in payload, false);
});

test("draft conflict is explicit when server revision has advanced", () => {
    const payload = draft.createContractDraft({ taskId: "task-1", templateId: null, sections: [], baseRevision: 4, savedAt: "2026-08-07T00:00:00.000Z" });

    assert.equal(draft.getContractDraftState(payload, { taskId: "task-1", revision: 4 }), "compatible");
    assert.equal(draft.getContractDraftState(payload, { taskId: "task-1", revision: 5 }), "conflict");
    assert.equal(draft.getContractDraftState(payload, { taskId: "task-2", revision: 4 }), "different-task");
    assert.equal(draft.canRestoreConflictingDraft(payload, "task-1"), true);
    assert.equal(draft.canRestoreConflictingDraft(payload, "task-2"), false);
});

test("unsubmitted draft restores only for the selected template", () => {
    const payload = draft.createContractDraft({ taskId: null, templateId: "template-1", sections: [{ id: "scope", title: "服务范围", content: "草稿" }], baseRevision: 0, savedAt: "2026-08-07T00:00:00.000Z" });

    assert.equal(draft.isTemplateDraft(payload, "template-1"), true);
    assert.equal(draft.isTemplateDraft(payload, "template-2"), false);
});
