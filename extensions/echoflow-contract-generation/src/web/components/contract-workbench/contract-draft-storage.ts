import { getLocalStorage, safeJsonParse, safeJsonStringify } from "@buildingai/stores";

import { createContractDraft, type ContractDraft } from "./contract-draft-rules";

export { canRestoreConflictingDraft, getContractDraftState, isTemplateDraft, type ContractDraft } from "./contract-draft-rules";

const CONTRACT_DRAFT_KEY = "echoflow-contract-generation:draft";

export function readContractDraft(): ContractDraft | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        return safeJsonParse<ContractDraft>(getLocalStorage().getItem(CONTRACT_DRAFT_KEY));
    } catch {
        return undefined;
    }
}

export function writeContractDraft(draft: ContractDraft): void {
    if (typeof window === "undefined") return;
    try {
        getLocalStorage().setItem(CONTRACT_DRAFT_KEY, safeJsonStringify(createContractDraft(draft)));
    } catch {
        return;
    }
}

export function clearContractDraft(): void {
    if (typeof window === "undefined") return;
    try {
        getLocalStorage().removeItem(CONTRACT_DRAFT_KEY);
    } catch {
        return;
    }
}
