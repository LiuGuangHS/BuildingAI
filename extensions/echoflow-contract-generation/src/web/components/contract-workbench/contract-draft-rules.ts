import type { ContractSection } from "../../services/types";

export type ContractDraft = {
    taskId: string | null;
    templateId: string | null;
    sections: ContractSection[];
    baseRevision: number;
    savedAt: string;
};

export function createContractDraft(input: ContractDraft): ContractDraft {
    return {
        taskId: input.taskId,
        templateId: input.templateId,
        sections: input.sections.map((section) => ({ ...section })),
        baseRevision: input.baseRevision,
        savedAt: input.savedAt,
    };
}

export function getContractDraftState(draft: ContractDraft, server: { taskId: string; revision: number }): "compatible" | "conflict" | "different-task" {
    if (draft.taskId !== server.taskId) return "different-task";
    return draft.baseRevision === server.revision ? "compatible" : "conflict";
}

export function canRestoreConflictingDraft(draft: ContractDraft, taskId: string | undefined): boolean {
    return Boolean(taskId && draft.taskId === taskId);
}

export function isTemplateDraft(draft: ContractDraft, templateId: string | undefined): boolean {
    return draft.taskId === null && Boolean(templateId && draft.templateId === templateId);
}
