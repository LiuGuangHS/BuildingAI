import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { uploadFile } from "@buildingai/services/shared";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { ContractInspector } from "../components/contract-workbench/ContractInspector";
import { ContractIntakeRail } from "../components/contract-workbench/ContractIntakeRail";
import { ContractTemplateDrawer } from "../components/contract-workbench/ContractTemplateDrawer";
import { ContractWorkbenchShell } from "../components/contract-workbench/ContractWorkbenchShell";
import { deriveContractWorkbenchState } from "../components/contract-workbench/contract-workbench-view-model";
import { useContractGenerationConfigQuery, useContractTaskDetailQuery, useContractTasksQuery, useContractTemplatesQuery, useContractVersionsQuery, useExportContractMutation, useGenerateContractMutation, useRestoreContractVersionMutation, useReviewContractMutation, useReviewUploadedContractMutation, useRewriteContractClauseMutation, useUpdateContractContentMutation, useUpdateRiskActionMutation } from "../services/web";
import { contractStatusText, contractStatusVariant, isContractBusyStatus, type ContractGenerationConfig, type ContractGenerationStatus, type ContractGenerationTask, type ContractSection, type ContractTemplate } from "../services/types";

type ContractStance = "neutral" | "favor_party_a" | "favor_party_b" | "strict" | "friendly";
type RewriteMode = "reduce_risk" | "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly";

const ContractDocumentWorkbench = lazy(() =>
    import("../components/contract-editor/ContractDocumentEditor").then((module) => ({
        default: module.ContractDocumentWorkbench,
    })),
);

function ContractDocumentLoading() {
    return (
        <div className="space-y-3 rounded-lg border bg-card p-4" role="status" aria-live="polite">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="min-h-[28rem] w-full rounded-lg" />
        </div>
    );
}

export default function ContractGenerationHomePage() {
    const { data: templates = [] } = useContractTemplatesQuery();
    const { data: config } = useContractGenerationConfigQuery();
    const { data: taskPage } = useContractTasksQuery({ page: 1, pageSize: 10 });
    const generateMutation = useGenerateContractMutation();
    const reviewUploadMutation = useReviewUploadedContractMutation();
    const reviewMutation = useReviewContractMutation();
    const rewriteMutation = useRewriteContractClauseMutation();
    const updateMutation = useUpdateContractContentMutation();
    const updateRiskActionMutation = useUpdateRiskActionMutation();
    const restoreVersionMutation = useRestoreContractVersionMutation();
    const exportMutation = useExportContractMutation();

    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [templateKeyword, setTemplateKeyword] = useState("");
    const [mode, setMode] = useState<"draft" | "review">("draft");
    const [title, setTitle] = useState("服务合同");
    const [reviewFile, setReviewFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState("");
    const [stance, setStance] = useState<ContractStance>("neutral");
    const [exportType, setExportType] = useState<"contract" | "contract_with_report" | "risk_report">("contract");
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [activeTaskId, setActiveTaskId] = useState("");
    const [localTask, setLocalTask] = useState<ContractGenerationTask | null>(null);
    const [sections, setSections] = useState<ContractSection[]>([]);
    const [draftSections, setDraftSections] = useState<ContractSection[]>([]);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [rewriteMode, setRewriteMode] = useState<RewriteMode>("reduce_risk");
    const [rewritePreview, setRewritePreview] = useState<{ content: string; reason: string } | null>(null);
    const [message, setMessage] = useState("");
    const [dirty, setDirty] = useState(false);
    const [documentRevision, setDocumentRevision] = useState(0);
    const { data: detailTask } = useContractTaskDetailQuery(activeTaskId);
    const activeTask = detailTask ?? localTask;
    const { data: versions = [] } = useContractVersionsQuery(activeTask?.id);
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
    const filteredTemplates = useMemo(() => {
        const keyword = templateKeyword.trim().toLowerCase();
        if (!keyword) return templates;
        return templates.filter((template) => `${template.name} ${template.industry} ${template.contractType} ${template.description}`.toLowerCase().includes(keyword));
    }, [templateKeyword, templates]);
    const canGenerate = Boolean(config?.canGenerate);
    const unavailableReason = config?.unavailableReason || "当前未配置可用模型，暂不能生成合同。请联系管理员在插件后台选择启用模型。";
    const isBusy = activeTask ? isContractBusyStatus(activeTask.status) : false;
    const canSave = Boolean(activeTask && sections.length > 0 && !isBusy);
    const canReview = Boolean(canGenerate && activeTask && sections.length > 0 && !isBusy);
    const canRewrite = Boolean(canGenerate && activeTask && selectedSectionIndex >= 0 && sections[selectedSectionIndex] && !isBusy);
    const canExport = Boolean(activeTask && sections.length > 0 && !isBusy);
    const workbenchState = useMemo(() => deriveContractWorkbenchState({
        mode,
        configured: canGenerate,
        template: selectedTemplate,
        variables,
        prompt,
        reviewFileName: reviewFile?.name ?? "",
        task: activeTask,
        dirty,
    }), [activeTask, canGenerate, dirty, mode, prompt, reviewFile?.name, selectedTemplate, variables]);

    useEffect(() => {
        if (!selectedTemplateId && templates[0]) {
            selectTemplate(templates[0]);
        }
    }, [selectedTemplateId, templates]);

    useEffect(() => {
        if (!detailTask) return;
        setLocalTask(detailTask);
        setTitle(detailTask.title);
        setSections(detailTask.sections ?? []);
        setSelectedSectionIndex(0);
        setDirty(false);
        setDocumentRevision((value) => value + 1);
    }, [detailTask?.id, detailTask?.updatedAt]);

    function setTask(task: ContractGenerationTask) {
        setLocalTask(task);
        setActiveTaskId(task.id);
        setTitle(task.title);
        setSections(task.sections ?? []);
        setDraftSections([]);
        setSelectedSectionIndex(0);
        setDirty(false);
        setDocumentRevision((value) => value + 1);
    }

    function selectTemplate(template: ContractTemplate) {
        setSelectedTemplateId(template.id);
        setTitle(template.name);
        setVariables({});
        setFieldErrors({});
        setPrompt("");
        setDraftSections([]);
        setSelectedSectionIndex(0);
        setDirty(false);
    }

    async function handleGenerate() {
        if (!canGenerate) {
            setMessage(unavailableReason);
            return;
        }
        if (!selectedTemplate) return;
        const errors = validateTemplateFields(selectedTemplate, variables);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            setMessage("请先补全必填合同信息。");
            return;
        }
        setMessage("合同任务已提交，正在后台生成。");
        try {
            const task = await generateMutation.mutateAsync({ title, templateId: selectedTemplate.id, contractType: selectedTemplate.contractType, industry: selectedTemplate.industry, variables, prompt: buildGenerationPrompt(prompt, draftSections), language: "zh-CN", stance });
            setTask(task);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "生成失败");
        }
    }

    async function handleReviewUpload() {
        if (!canGenerate) {
            setMessage(unavailableReason);
            return;
        }
        if (!reviewFile) {
            setMessage("请上传已有合同文件。");
            return;
        }
        setMessage("文件上传中，随后会开始合同审查。");
        try {
            const uploaded = await uploadFile(reviewFile, { description: "合同审查文件", extensionId: "echoflow-contract-generation" });
            if (!uploaded.id) throw new Error("平台上传未返回 fileId，请检查存储配置");
            const task = await reviewUploadMutation.mutateAsync({ title: title.trim() || undefined, fileId: uploaded.id, contractType: selectedTemplate?.contractType, industry: selectedTemplate?.industry, stance });
            setTask(task);
            setMessage("审查任务已提交，正在后台解析合同。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "审查失败");
        }
    }

    async function handlePrimaryAction() {
        if (mode === "review" && !activeTask) {
            await handleReviewUpload();
            return;
        }
        if (!activeTask) {
            await handleGenerate();
            return;
        }
        if (dirty) {
            await handleSave();
            return;
        }
        if (activeTask.riskFindings.length > 0) {
            await handleExport();
            return;
        }
        await handleReview();
    }

    async function handleSave() {
        if (!activeTask) return;
        setMessage("正在保存修改...");
        try {
            const task = await updateMutation.mutateAsync({ taskId: activeTask.id, params: { title, summary: activeTask.summary ?? undefined, sections } });
            setTask(task);
            setMessage("修改已保存。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    async function handleReview() {
        if (!activeTask) return;
        if (!canGenerate) {
            setMessage(unavailableReason);
            return;
        }
        setMessage("正在审查合同风险...");
        try {
            const task = await reviewMutation.mutateAsync(activeTask.id);
            setTask(task);
            setMessage("风险审查已更新。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "审查失败");
        }
    }

    async function handleRewrite() {
        if (!activeTask || !sections[selectedSectionIndex]) return;
        if (!canGenerate) {
            setMessage(unavailableReason);
            return;
        }
        const section = sections[selectedSectionIndex];
        setMessage("正在优化条款...");
        try {
            const result = await rewriteMutation.mutateAsync({ taskId: activeTask.id, params: { sectionTitle: section.title, content: section.content, mode: rewriteMode } });
            setRewritePreview(result);
            setMessage("已生成条款改写建议。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "优化失败");
        }
    }

    function applyRewritePreview() {
        if (!rewritePreview) return;
        setSections((items) => items.map((item, index) => (index === selectedSectionIndex ? { ...item, content: rewritePreview.content } : item)));
        setRewritePreview(null);
        setDirty(true);
        setDocumentRevision((value) => value + 1);
        setMessage("已应用改写建议，请保存修改。");
    }

    async function handleExport() {
        if (!activeTask) return;
        setMessage("正在导出 Word 合同...");
        try {
            const task = await exportMutation.mutateAsync({ taskId: activeTask.id, params: { exportType } });
            setTask(task);
            setMessage("导出完成。");
            if (task.resultUrl) window.open(task.resultUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "导出失败");
        }
    }

    async function handleAcceptRisk(index: number) {
        if (!activeTask) return;
        const risk = activeTask.riskFindings?.[index];
        if (!risk?.replacementText) {
            setMessage("该风险建议没有可直接替换的条款文本。");
            return;
        }
        const sectionIndex = sections.findIndex((section) => section.title.includes(risk.sectionTitle) || risk.sectionTitle.includes(section.title));
        if (sectionIndex < 0) {
            setMessage("未找到对应条款，请手动复制建议文本。");
            return;
        }
        const nextSections = sections.map((item, itemIndex) => (itemIndex === sectionIndex ? { ...item, content: risk.replacementText! } : item));
        try {
            const task = await updateRiskActionMutation.mutateAsync({ taskId: activeTask.id, params: { riskKey: getRiskKey(risk, index), status: "accepted", sections: nextSections } });
            setTask(task);
            setSelectedSectionIndex(sectionIndex);
            setMessage("已采纳风险建议并记录版本。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "采纳失败");
        }
    }

    async function handleIgnoreRisk(index: number) {
        const risk = activeTask?.riskFindings?.[index];
        if (!risk || !activeTask) return;
        try {
            const task = await updateRiskActionMutation.mutateAsync({ taskId: activeTask.id, params: { riskKey: getRiskKey(risk, index), status: "ignored" } });
            setTask(task);
            setMessage("已忽略风险建议。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "忽略失败");
        }
    }

    async function handleRestoreVersion(versionId: string) {
        if (!activeTask) return;
        try {
            const task = await restoreVersionMutation.mutateAsync({ taskId: activeTask.id, versionId });
            setTask(task);
            setMessage("已恢复历史版本。");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "恢复失败");
        }
    }

    function replaceSections(nextSections: ContractSection[]) {
        if (!activeTask) {
            setDraftSections(nextSections);
            setDirty(true);
            if (selectedSectionIndex >= nextSections.length) {
                setSelectedSectionIndex(Math.max(0, nextSections.length - 1));
            }
            return;
        }
        setSections(nextSections);
        setDirty(true);
        if (selectedSectionIndex >= nextSections.length) {
            setSelectedSectionIndex(Math.max(0, nextSections.length - 1));
        }
    }

    const primaryActionPending = generateMutation.isPending || reviewUploadMutation.isPending || updateMutation.isPending || reviewMutation.isPending || exportMutation.isPending;
    const visibleSections = activeTask ? sections : draftSections;
    const selectedSection = visibleSections[selectedSectionIndex];

    return (
        <ContractWorkbenchShell
            state={workbenchState}
            topTools={
                <>
                    <ModelStatus config={config} />
                    <TaskStatusBadge status={activeTask?.status ?? "draft"} />
                    {dirty && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">{activeTask ? "未保存" : "草稿"}</Badge>}
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={!canSave}>保存</Button>
                    <Button variant="outline" size="sm" onClick={handleReview} disabled={!canReview || reviewMutation.isPending} loading={reviewMutation.isPending}>AI 审查</Button>
                    <Button size="sm" onClick={handleExport} disabled={!canExport}>导出</Button>
                </>
            }
            intake={
                <>
                    <ContractTemplateDrawer
                        templates={filteredTemplates}
                        tasks={taskPage?.items ?? []}
                        keyword={templateKeyword}
                        selectedTemplate={selectedTemplate}
                        disabled={!canGenerate}
                        onKeywordChange={setTemplateKeyword}
                        onSelectTemplate={selectTemplate}
                        onSelectTask={setTask}
                    />
                    <ContractIntakeRail
                        state={workbenchState}
                        mode={mode}
                        disabled={!canGenerate}
                        onModeChange={setMode}
                        selectedTemplate={selectedTemplate}
                        variables={variables}
                        errors={fieldErrors}
                        prompt={prompt}
                        reviewFile={reviewFile}
                        stance={stance}
                        exportType={exportType}
                        isBusy={isBusy}
                        primaryActionPending={primaryActionPending}
                        primaryActionLabel={workbenchState.primaryAction.label}
                        onPrimaryAction={handlePrimaryAction}
                        onVariablesChange={(nextVariables) => {
                            setVariables(nextVariables);
                            if (selectedTemplate) setFieldErrors(validateTemplateFields(selectedTemplate, nextVariables));
                        }}
                        onPromptChange={setPrompt}
                        onReviewFileChange={setReviewFile}
                        onStanceChange={(value) => setStance(value as ContractStance)}
                        onExportTypeChange={setExportType}
                        onFillExample={() => fillExample(selectedTemplate, setVariables, setTitle, setPrompt)}
                    />
                </>
            }
            document={
                <>
                    {message && <div className="mb-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground">{message}</div>}
                    <Suspense fallback={<ContractDocumentLoading />}>
                        <ContractDocumentWorkbench
                            activeTask={activeTask}
                            template={selectedTemplate}
                            title={title}
                            variables={variables}
                            sections={activeTask ? sections : draftSections}
                            documentRevision={documentRevision}
                            selectedSectionIndex={selectedSectionIndex}
                            draftEditable={!activeTask && canGenerate}
                            dirty={dirty}
                            canSave={canSave}
                            canReview={canReview}
                            canExport={canExport}
                            onSelectSection={setSelectedSectionIndex}
                            onSectionsChange={replaceSections}
                            onSave={handleSave}
                            onReview={handleReview}
                            onExport={handleExport}
                        />
                    </Suspense>
                </>
            }
            inspector={
                <ContractInspector
                    task={activeTask}
                    versions={versions}
                    selectedSection={selectedSection}
                    rewriteMode={rewriteMode}
                    rewritePreview={rewritePreview}
                    rewritePending={rewriteMutation.isPending}
                    reviewPending={reviewMutation.isPending}
                    exportType={exportType}
                    dirty={dirty}
                            canReview={canReview}
                            canRewrite={canRewrite}
                    canExport={canExport}
                    onRewriteModeChange={setRewriteMode}
                    onRewrite={handleRewrite}
                    onApplyRewrite={applyRewritePreview}
                    onCancelRewrite={() => setRewritePreview(null)}
                    onReview={handleReview}
                    onExport={handleExport}
                    onAcceptRisk={handleAcceptRisk}
                    onIgnoreRisk={handleIgnoreRisk}
                    onSelectSection={setSelectedSectionIndex}
                    onRestoreVersion={handleRestoreVersion}
                />
            }
        />
    );
}

function ModelStatus({ config }: { config?: ContractGenerationConfig }) {
    return <Badge variant={config?.canGenerate ? "default" : "destructive"}>{config?.canGenerate && config.model ? `${config.model.name} / ${formatCredits(config.model.pricePerContract)}` : "模型未配置"}</Badge>;
}

function TaskStatusBadge({ status }: { status: ContractGenerationStatus | "draft" }) {
    return <Badge variant={contractStatusVariant(status)}>{contractStatusText(status)}</Badge>;
}

function validateTemplateFields(template: ContractTemplate, variables: Record<string, string>) {
    return template.fields.reduce<Record<string, string>>((errors, field) => {
        if (field.required && !String(variables[field.key] ?? "").trim()) errors[field.key] = `请填写${field.label}`;
        return errors;
    }, {});
}

function buildGenerationPrompt(prompt: string, draftSections: ContractSection[]) {
    const draftText = draftSections
        .filter((section) => section.title.trim() || section.content.trim())
        .map((section, index) => {
            const title = section.title.trim() || `第 ${index + 1} 条`;
            const content = section.content.trim();
            return `${index + 1}. ${title}\n${content}`;
        })
        .join("\n\n");
    if (!draftText) return prompt;
    return [
        prompt.trim(),
        "用户已在工作区预写了以下合同草稿，请在正式起草时优先保留其结构和业务意图，并补全为可签署合同：",
        draftText,
    ].filter(Boolean).join("\n\n");
}

function fillExample(template: ContractTemplate | undefined, setVariables: (value: Record<string, string>) => void, setTitle: (value: string) => void, setPrompt: (value: string) => void) {
    const fallbackTemplate = {
        name: "企业服务合同",
        fields: [
            { key: "partyA", label: "甲方", required: true, type: "text" as const },
            { key: "partyB", label: "乙方", required: true, type: "text" as const },
            { key: "serviceScope", label: "服务范围", required: true, type: "text" as const },
            { key: "fees", label: "费用与付款", required: true, type: "text" as const },
            { key: "term", label: "合同期限", required: true, type: "text" as const },
        ],
    } satisfies Pick<ContractTemplate, "name" | "fields">;
    const source = template ?? fallbackTemplate;
    const values = source.fields.reduce<Record<string, string>>((accumulator, field) => {
        accumulator[field.key] = exampleValue(field.key, field.label, field.options);
        return accumulator;
    }, {});
    setVariables(values);
    setTitle(`${source.name}（示例）`);
    setPrompt("请强化付款节点、验收标准和违约责任，条款表达保持专业、清晰、可执行。");
}

function exampleValue(key: string, label: string, options?: string[]) {
    if (options?.length) return options[0] ?? "";
    if (key.toLowerCase().includes("partya") || label.includes("甲方")) return "北京星河科技有限公司";
    if (key.toLowerCase().includes("partyb") || label.includes("乙方")) return "上海云舟服务有限公司";
    if (label.includes("费用") || label.includes("金额") || label.includes("价格") || label.includes("租金") || label.includes("报酬")) return "人民币 100,000 元";
    if (label.includes("日期")) return "2026-06-01";
    if (label.includes("期限") || label.includes("周期")) return "自 2026 年 6 月 1 日起至 2026 年 12 月 31 日止";
    if (label.includes("地址")) return "上海市浦东新区示例路 88 号";
    if (label.includes("内容") || label.includes("范围") || label.includes("职责") || label.includes("标准")) return "双方围绕企业数字化项目提供咨询、实施和交付服务，具体以双方确认的工作说明书为准。";
    return `${label}示例内容`;
}

function getRiskKey(risk: { id?: string; sectionTitle: string; issue: string }, index: number) {
    return risk.id || `${index}:${risk.sectionTitle}:${risk.issue}`;
}

function formatCredits(value?: number) {
    return value ? `${value} 积分` : "0 积分";
}
