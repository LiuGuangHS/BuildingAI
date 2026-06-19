export type ContractGenerationStatus = "pending" | "processing" | "draft" | "reviewing" | "exporting" | "success" | "failed" | "export_failed";

export type ContractTemplateField = {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select";
    required?: boolean;
    placeholder?: string;
    options?: string[];
};

export type ContractTemplate = {
    id: string;
    name: string;
    industry: string;
    contractType: string;
    description: string;
    fields: ContractTemplateField[];
    defaultSections: string[];
    promptTemplate?: string | null;
    isBuiltin?: boolean;
    isActive?: boolean;
    sortOrder?: number;
};

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
    modelId?: string;
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
    model?: {
        id: string;
        name: string;
        providerName: string;
        provider: string;
        pricePerContract?: number;
    } | null;
};

export type AdminContractGenerationConfig = ContractGenerationConfig & {
    id: string;
    key: string;
    modelId?: string | null;
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

export type ContractGenerationTask = {
    id: string;
    userId: string;
    modelId?: string;
    providerId?: string;
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
    providerMetadata?: Record<string, unknown>;
    requestPayload?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
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

export type AiProviderResponse = {
    id: string;
    name: string;
    provider: string;
    models?: Array<{
        id: string;
        name: string;
        model: string;
        modelType: string;
        isActive?: boolean;
    }>;
};

export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
