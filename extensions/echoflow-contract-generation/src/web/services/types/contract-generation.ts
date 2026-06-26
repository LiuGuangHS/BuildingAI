export type ContractGenerationStatus = "pending" | "processing" | "draft" | "reviewing" | "exporting" | "success" | "failed" | "export_failed";

export function contractStatusText(status: ContractGenerationStatus | "draft" | string) {
    return { pending: "等待中", processing: "生成中", draft: "草稿", reviewing: "审查中", exporting: "导出中", success: "已导出", failed: "失败", export_failed: "导出失败" }[status] ?? status;
}

export function contractStatusVariant(status: ContractGenerationStatus | "draft" | string): "default" | "secondary" | "destructive" | "outline" {
    if (["failed", "export_failed"].includes(status)) return "destructive";
    if (["pending", "processing", "reviewing", "exporting"].includes(status)) return "secondary";
    if (status === "draft") return "outline";
    return "default";
}

export function isContractBusyStatus(status: ContractGenerationStatus | string) {
    return ["pending", "processing", "reviewing", "exporting"].includes(status);
}

export type ContractTemplateField = {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select";
    required?: boolean;
    placeholder?: string;
    options?: string[];
};

export type PublicContractTemplate = {
    id: string;
    name: string;
    industry: string;
    contractType: string;
    description: string;
    fields: ContractTemplateField[];
    defaultSections: string[];
};

export type AdminContractTemplate = PublicContractTemplate & {
    promptTemplate?: string | null;
    isBuiltin?: boolean;
    isActive?: boolean;
    sortOrder?: number;
};

export type ContractTemplate = PublicContractTemplate;

export type UpsertContractTemplateParams = {
    name: string;
    industry: string;
    contractType: string;
    description: string;
    fields: ContractTemplateField[];
    defaultSections: string[];
    promptTemplate?: string;
    isActive?: boolean;
    sortOrder?: number;
};

export type AiModelOption = {
    id: string;
    name: string;
    model: string;
    modelType: string;
    providerName: string;
    provider: string;
    pricePerContract?: number;
};

export type ContractSection = {
    id?: string;
    title: string;
    content: string;
    importance?: "normal" | "important" | "critical";
};

export type ContractRiskFinding = {
    sectionTitle: string;
    level: "low" | "medium" | "high";
    issue: string;
    suggestion: string;
    replacementText?: string;
};

export type ContractLegalTerm = {
    term: string;
    explanation: string;
};

export type ContractScore = {
    overall: number;
    completeness: number;
    riskControl: number;
    clarity: number;
    missingItems: string[];
};

export type RiskActions = Record<string, { status: "accepted" | "ignored"; actedAt: string }>;

export type GenerateContractParams = {
    title: string;
    templateId?: string;
    contractType?: string;
    industry?: string;
    variables?: Record<string, unknown>;
    prompt?: string;
    language?: string;
    stance?: "neutral" | "favor_party_a" | "favor_party_b" | "strict" | "friendly";
};

export type ReviewUploadedContractParams = {
    title?: string;
    fileId: string;
    contractType?: string;
    industry?: string;
    stance?: "neutral" | "favor_party_a" | "favor_party_b" | "strict" | "friendly";
};

export type ExportContractParams = {
    includeRiskReport?: boolean;
    exportType?: "contract" | "contract_with_report" | "risk_report";
};

export type ContractGenerationConfig = {
    configured: boolean;
    canGenerate: boolean;
    unavailableReason?: string | null;
    pricePerContract?: number;
    model?: {
        name: string;
        pricePerContract?: number;
    } | null;
};

export type AdminContractGenerationConfig = Omit<ContractGenerationConfig, "model"> & {
    id: string;
    key: string;
    modelId?: string | null;
    model?: {
        id: string;
        name: string;
        providerName: string;
        provider: string;
        pricePerContract?: number;
    } | null;
    metadata: Record<string, unknown>;
};

export type UpdateContractContentParams = {
    title?: string;
    summary?: string;
    sections: ContractSection[];
};

export type RewriteContractClauseParams = {
    sectionTitle: string;
    content: string;
    mode?: "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly" | "reduce_risk";
};

export type RewriteContractClauseResult = {
    content: string;
    reason: string;
};

export type PublicContractTaskMetadata = {
    templateName?: unknown;
    language?: unknown;
    stance?: unknown;
    exportedAt?: unknown;
    exportType?: unknown;
    billingStatus?: unknown;
    refundedAt?: unknown;
};

export type ContractGenerationTask = {
    id: string;
    title: string;
    contractType: string;
    industry?: string | null;
    templateId?: string | null;
    parties: Array<{ name: string; role?: string; contact?: string }>;
    variables: Record<string, unknown>;
    prompt?: string | null;
    summary?: string | null;
    sections: ContractSection[];
    riskFindings: ContractRiskFinding[];
    legalTerms: ContractLegalTerm[];
    score?: ContractScore | null;
    riskActions: RiskActions;
    status: ContractGenerationStatus;
    resultUrl?: string | null;
    errorMessage?: string | null;
    costCredits: number;
    providerMetadata?: PublicContractTaskMetadata;
    createdAt: string;
    updatedAt: string;
};

export type AdminContractGenerationTask = ContractGenerationTask & {
    userId: string;
    modelId?: string;
    providerId?: string;
    requestPayload?: Record<string, unknown> | null;
    providerMetadata?: Record<string, unknown>;
};

export type ContractGenerationVersion = {
    id: string;
    taskId: string;
    versionNo: number;
    title: string;
    summary?: string | null;
    sections: ContractSection[];
    riskFindings: ContractRiskFinding[];
    legalTerms: ContractLegalTerm[];
    score?: ContractScore | null;
    riskActions: RiskActions;
    changeType: string;
    changeSummary?: string | null;
    createdAt: string;
};

export type UpdateRiskActionParams = {
    riskKey: string;
    status: "accepted" | "ignored";
    sections?: ContractSection[];
};

export type QueryContractTasksParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: ContractGenerationStatus;
    templateId?: string;
    contractType?: string;
};

export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
