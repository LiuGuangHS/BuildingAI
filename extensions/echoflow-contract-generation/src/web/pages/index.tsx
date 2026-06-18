import { uploadFile } from "@buildingai/services/shared";
import { useEffect, useMemo, useState } from "react";

import { useContractGenerationConfigQuery, useContractTaskDetailQuery, useContractTasksQuery, useContractTemplatesQuery, useContractVersionsQuery, useExportContractMutation, useGenerateContractMutation, useRestoreContractVersionMutation, useReviewContractMutation, useReviewUploadedContractMutation, useRewriteContractClauseMutation, useUpdateContractContentMutation, useUpdateRiskActionMutation } from "../services/web";
import type { ContractGenerationConfig, ContractGenerationStatus, ContractGenerationTask, ContractGenerationVersion, ContractRiskFinding, ContractSection, ContractTemplate } from "../services/types";

const rewriteModes = [
    { value: "reduce_risk", label: "降低风险" },
    { value: "stricter", label: "更严谨" },
    { value: "favor_party_a", label: "偏甲方" },
    { value: "favor_party_b", label: "偏乙方" },
    { value: "concise", label: "更简洁" },
    { value: "friendly", label: "更友好" },
] as const;

const stanceOptions = [
    { value: "neutral", label: "中立平衡" },
    { value: "favor_party_a", label: "偏甲方" },
    { value: "favor_party_b", label: "偏乙方" },
    { value: "strict", label: "更严格" },
    { value: "friendly", label: "更友好" },
] as const;

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
    const [stance, setStance] = useState<(typeof stanceOptions)[number]["value"]>("neutral");
    const [exportType, setExportType] = useState<"contract" | "contract_with_report" | "risk_report">("contract");
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [activeTaskId, setActiveTaskId] = useState("");
    const [localTask, setLocalTask] = useState<ContractGenerationTask | null>(null);
    const [sections, setSections] = useState<ContractSection[]>([]);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [rewriteMode, setRewriteMode] = useState<(typeof rewriteModes)[number]["value"]>("reduce_risk");
    const [rewritePreview, setRewritePreview] = useState<{ content: string; reason: string } | null>(null);
    const [message, setMessage] = useState("");
    const [recentCollapsed, setRecentCollapsed] = useState(false);
    const [dirty, setDirty] = useState(false);
    const { data: detailTask } = useContractTaskDetailQuery(activeTaskId);
    const activeTask = detailTask ?? localTask;
    const { data: versions = [] } = useContractVersionsQuery(activeTask?.id);
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
    const filteredTemplates = useMemo(() => {
        const keyword = templateKeyword.trim().toLowerCase();
        if (!keyword) return templates;
        return templates.filter((template) => `${template.name} ${template.industry} ${template.contractType} ${template.description}`.toLowerCase().includes(keyword));
    }, [templateKeyword, templates]);
    const isBusy = activeTask ? isBusyStatus(activeTask.status) : false;
    const canSave = Boolean(activeTask && sections.length > 0 && !isBusy);
    const canReview = Boolean(activeTask && sections.length > 0 && !isBusy);
    const canExport = Boolean(activeTask && sections.length > 0 && !isBusy);

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
    }, [detailTask?.id, detailTask?.updatedAt]);

    function setTask(task: ContractGenerationTask) {
        setLocalTask(task);
        setActiveTaskId(task.id);
        setTitle(task.title);
        setSections(task.sections ?? []);
        setSelectedSectionIndex(0);
        setDirty(false);
    }

    function selectTemplate(template: ContractTemplate) {
        setSelectedTemplateId(template.id);
        setTitle(template.name);
        setVariables({});
        setFieldErrors({});
        setPrompt("");
    }

    async function handleGenerate() {
        if (!config?.configured) {
            setMessage("AI 合同插件尚未配置固定模型，请联系管理员在插件后台配置。");
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
            const task = await generateMutation.mutateAsync({ title, templateId: selectedTemplate.id, contractType: selectedTemplate.contractType, industry: selectedTemplate.industry, variables, prompt, language: "zh-CN", stance });
            setTask(task);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "生成失败");
        }
    }

    async function handleReviewUpload() {
        if (!config?.configured) {
            setMessage("AI 合同插件尚未配置固定模型，请联系管理员在插件后台配置。");
            return;
        }
        if (!reviewFile) {
            setMessage("请上传已有合同文件。");
            return;
        }
        setMessage("文件上传中，随后会开始合同审查。");
        try {
            const uploaded = await uploadFile(reviewFile, { description: "AI合同审查文件", extensionId: "echoflow-contract-generation" });
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

    function patchSection(index: number, patch: Partial<ContractSection>) {
        setSections((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
        setDirty(true);
    }

    return (
        <main className="contract-workbench">
            <header className="contract-workbench-header">
                <div>
                    <p>AI 合同工作台</p>
                    <h1>起草、审查、优化和导出合同</h1>
                </div>
                <div className="contract-header-status">
                    <ModelStatus config={config} />
                    <span className={`contract-status-pill ${activeTask ? statusClass(activeTask.status) : "is-muted"}`}>{statusText(activeTask?.status ?? "draft")}</span>
                    {dirty && <span className="contract-status-pill is-warning">有未保存修改</span>}
                </div>
                <button className="contract-button is-primary" onClick={handlePrimaryAction} disabled={isBusy || generateMutation.isPending || reviewUploadMutation.isPending || updateMutation.isPending || reviewMutation.isPending || exportMutation.isPending}>
                    {primaryActionText({ mode, activeTask, dirty })}
                </button>
            </header>

            {message && <div className="contract-notice">{message}</div>}

            <section className="contract-workbench-grid">
                <TemplateSidebar
                    templates={filteredTemplates}
                    keyword={templateKeyword}
                    selectedTemplate={selectedTemplate}
                    tasks={taskPage?.items ?? []}
                    recentCollapsed={recentCollapsed}
                    onKeywordChange={setTemplateKeyword}
                    onSelectTemplate={selectTemplate}
                    onSelectTask={setTask}
                    onToggleRecent={() => setRecentCollapsed((value) => !value)}
                />

                <section className="contract-main-panel contract-panel">
                    <div className="contract-panel-head">
                        <div>
                            <h2>合同工作区</h2>
                            <p>{selectedTemplate?.description || "选择模板并填写信息后，合同条款会出现在这里。"}</p>
                        </div>
                        <div className="contract-tabs">
                            <button className={mode === "draft" ? "is-active" : ""} onClick={() => setMode("draft")} type="button">起草合同</button>
                            <button className={mode === "review" ? "is-active" : ""} onClick={() => setMode("review")} type="button">审查已有合同</button>
                        </div>
                    </div>

                    <WorkspaceSetup
                        mode={mode}
                        title={title}
                        selectedTemplate={selectedTemplate}
                        variables={variables}
                        errors={fieldErrors}
                        prompt={prompt}
                        reviewFile={reviewFile}
                        stance={stance}
                        exportType={exportType}
                        onTitleChange={(value) => { setTitle(value); if (activeTask) setDirty(true); }}
                        onVariablesChange={(nextVariables) => {
                            setVariables(nextVariables);
                            if (selectedTemplate) setFieldErrors(validateTemplateFields(selectedTemplate, nextVariables));
                        }}
                        onPromptChange={setPrompt}
                        onReviewFileChange={setReviewFile}
                        onStanceChange={setStance}
                        onExportTypeChange={setExportType}
                        onFillExample={() => fillExample(selectedTemplate, setVariables, setTitle, setPrompt)}
                    />

                    <WorkspaceActions
                        activeTask={activeTask}
                        dirty={dirty}
                        canSave={canSave}
                        canReview={canReview}
                        canExport={canExport}
                        isBusy={isBusy}
                        onSave={handleSave}
                        onReview={handleReview}
                        onExport={handleExport}
                    />

                    <ClauseEditor
                        activeTask={activeTask}
                        sections={sections}
                        selectedSectionIndex={selectedSectionIndex}
                        rewriteMode={rewriteMode}
                        rewritePreview={rewritePreview}
                        rewritePending={rewriteMutation.isPending}
                        onSelectSection={setSelectedSectionIndex}
                        onPatchSection={patchSection}
                        onRewriteModeChange={setRewriteMode}
                        onRewrite={handleRewrite}
                        onApplyRewrite={applyRewritePreview}
                        onCancelRewrite={() => setRewritePreview(null)}
                    />
                </section>

                <RiskInsightPanel
                    task={activeTask}
                    versions={versions}
                    onReview={handleReview}
                    onAcceptRisk={handleAcceptRisk}
                    onIgnoreRisk={handleIgnoreRisk}
                    onRestoreVersion={handleRestoreVersion}
                    reviewPending={reviewMutation.isPending}
                />
            </section>
        </main>
    );
}

function TemplateSidebar({ templates, keyword, selectedTemplate, tasks, recentCollapsed, onKeywordChange, onSelectTemplate, onSelectTask, onToggleRecent }: { templates: ContractTemplate[]; keyword: string; selectedTemplate?: ContractTemplate; tasks: ContractGenerationTask[]; recentCollapsed: boolean; onKeywordChange: (value: string) => void; onSelectTemplate: (template: ContractTemplate) => void; onSelectTask: (task: ContractGenerationTask) => void; onToggleRecent: () => void }) {
    return (
        <aside className="contract-sidebar contract-panel">
            <div className="contract-panel-head is-compact">
                <div><h2>模板</h2><p>选择常用合同类型</p></div>
            </div>
            <input className="contract-search" value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="搜索模板、行业或类型" />
            <div className="contract-template-list">
                {templates.map((template) => (
                    <button key={template.id} className={`contract-template-item ${selectedTemplate?.id === template.id ? "is-active" : ""}`} onClick={() => onSelectTemplate(template)} type="button">
                        <strong>{template.name}</strong>
                        <span>{template.industry} / {template.contractType}</span>
                    </button>
                ))}
                {templates.length === 0 && <div className="contract-empty">没有匹配模板。</div>}
            </div>
            <div className="contract-sidebar-section">
                <div className="contract-panel-head is-compact">
                    <div><h2>最近合同</h2><p>{tasks.length} 个任务</p></div>
                    <button className="contract-link-button" onClick={onToggleRecent} type="button">{recentCollapsed ? "展开" : "收起"}</button>
                </div>
                {!recentCollapsed && (
                    <div className="contract-task-list">
                        {tasks.map((task) => (
                            <button key={task.id} onClick={() => onSelectTask(task)} type="button">
                                <strong>{task.title}</strong>
                                <span>{statusText(task.status)} / {new Date(task.createdAt).toLocaleDateString()}</span>
                            </button>
                        ))}
                        {tasks.length === 0 && <div className="contract-empty">暂无最近合同。</div>}
                    </div>
                )}
            </div>
        </aside>
    );
}

function WorkspaceSetup(props: {
    mode: "draft" | "review";
    title: string;
    selectedTemplate?: ContractTemplate;
    variables: Record<string, string>;
    errors: Record<string, string>;
    prompt: string;
    reviewFile: File | null;
    stance: (typeof stanceOptions)[number]["value"];
    exportType: "contract" | "contract_with_report" | "risk_report";
    onTitleChange: (value: string) => void;
    onVariablesChange: (value: Record<string, string>) => void;
    onPromptChange: (value: string) => void;
    onReviewFileChange: (value: File | null) => void;
    onStanceChange: (value: (typeof stanceOptions)[number]["value"]) => void;
    onExportTypeChange: (value: "contract" | "contract_with_report" | "risk_report") => void;
    onFillExample: () => void;
}) {
    return (
        <section className="contract-setup">
            <div className="contract-form-grid">
                <Field label="合同标题" value={props.title} onChange={props.onTitleChange} />
                <label className="contract-field">
                    <span>合同立场</span>
                    <select value={props.stance} onChange={(event) => props.onStanceChange(event.target.value as typeof props.stance)}>
                        {stanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <label className="contract-field">
                    <span>导出类型</span>
                    <select value={props.exportType} onChange={(event) => props.onExportTypeChange(event.target.value as typeof props.exportType)}>
                        <option value="contract">正式合同</option>
                        <option value="contract_with_report">合同 + 风险报告</option>
                        <option value="risk_report">仅风险报告</option>
                    </select>
                </label>
                <button className="contract-button" onClick={props.onFillExample} type="button">填入示例</button>
            </div>

            {props.mode === "draft" && props.selectedTemplate && (
                <>
                    <TemplateForm template={props.selectedTemplate} variables={props.variables} errors={props.errors} onChange={props.onVariablesChange} />
                    <label className="contract-field is-wide">
                        <span>补充要求</span>
                        <textarea value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder="例如：违约责任更严格、付款节点按 30/40/30、争议解决放在上海..." />
                    </label>
                </>
            )}

            {props.mode === "review" && (
                <div className="contract-upload-panel">
                    <label className="contract-field is-wide">
                        <span>已有合同文件</span>
                        <input type="file" accept=".doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => props.onReviewFileChange(event.target.files?.[0] ?? null)} />
                        <small>{props.reviewFile ? `已选择：${props.reviewFile.name}` : "支持 Word/PDF/文本等可解析文件，文件会先上传到平台后再审查。"}</small>
                    </label>
                </div>
            )}
        </section>
    );
}

function WorkspaceActions({ activeTask, dirty, canSave, canReview, canExport, isBusy, onSave, onReview, onExport }: { activeTask: ContractGenerationTask | null | undefined; dirty: boolean; canSave: boolean; canReview: boolean; canExport: boolean; isBusy: boolean; onSave: () => void; onReview: () => void; onExport: () => void }) {
    return (
        <div className="contract-workspace-actions">
            <span>{activeTask ? (isBusy ? "任务处理中，完成后会自动刷新。" : dirty ? "当前合同有未保存修改。" : "当前合同已同步。") : "生成或审查合同后，可继续编辑、审查和导出。"}</span>
            <div>
                <button className="contract-button" onClick={onSave} disabled={!canSave}>保存修改</button>
                <button className="contract-button" onClick={onReview} disabled={!canReview}>风险审查</button>
                <button className="contract-button" onClick={onExport} disabled={!canExport}>导出 Word</button>
            </div>
        </div>
    );
}

function ClauseEditor(props: {
    activeTask: ContractGenerationTask | null | undefined;
    sections: ContractSection[];
    selectedSectionIndex: number;
    rewriteMode: (typeof rewriteModes)[number]["value"];
    rewritePreview: { content: string; reason: string } | null;
    rewritePending: boolean;
    onSelectSection: (index: number) => void;
    onPatchSection: (index: number, patch: Partial<ContractSection>) => void;
    onRewriteModeChange: (value: (typeof rewriteModes)[number]["value"]) => void;
    onRewrite: () => void;
    onApplyRewrite: () => void;
    onCancelRewrite: () => void;
}) {
    const section = props.sections[props.selectedSectionIndex];
    return (
        <section className="contract-clause-workbench">
            <aside className="contract-clause-nav">
                <div className="contract-mini-title">条款目录</div>
                {props.sections.map((item, index) => (
                    <button key={item.id ?? index} className={index === props.selectedSectionIndex ? "is-active" : ""} onClick={() => props.onSelectSection(index)} type="button">
                        <span>{index + 1}</span>
                        <strong>{item.title}</strong>
                        <em>{riskForSection(props.activeTask ?? null, item.title) ? "需关注" : "正常"}</em>
                    </button>
                ))}
                {props.sections.length === 0 && <div className="contract-empty">生成合同后显示条款目录。</div>}
            </aside>
            <article className="contract-clause-editor">
                {section ? (
                    <>
                        <div className="contract-clause-toolbar">
                            <strong>{props.selectedSectionIndex + 1}. {section.title}</strong>
                            <button className="contract-button" onClick={props.onRewrite} disabled={!props.activeTask || props.rewritePending}>AI 优化</button>
                        </div>
                        <input value={section.title} onChange={(event) => props.onPatchSection(props.selectedSectionIndex, { title: event.target.value })} />
                        <textarea value={section.content} onChange={(event) => props.onPatchSection(props.selectedSectionIndex, { content: event.target.value })} />
                    </>
                ) : (
                    <div className="contract-empty is-large">选择模板并生成合同后，可在这里逐条编辑条款。</div>
                )}
            </article>
            <aside className="contract-ai-panel">
                <h3>AI 条款助手</h3>
                <select value={props.rewriteMode} onChange={(event) => props.onRewriteModeChange(event.target.value as typeof props.rewriteMode)}>
                    {rewriteModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                </select>
                {props.rewritePreview ? (
                    <div className="contract-suggestion-card">
                        <strong>改写建议</strong>
                        <p>{props.rewritePreview.reason}</p>
                        <p>{props.rewritePreview.content}</p>
                        <div>
                            <button className="contract-button is-primary" onClick={props.onApplyRewrite}>应用到当前条款</button>
                            <button className="contract-button" onClick={props.onCancelRewrite}>取消</button>
                        </div>
                    </div>
                ) : (
                    <p>选择条款后，可生成更严谨、更友好或偏向特定立场的改写建议。</p>
                )}
            </aside>
        </section>
    );
}

function RiskInsightPanel({ task, versions, reviewPending, onReview, onAcceptRisk, onIgnoreRisk, onRestoreVersion }: { task: ContractGenerationTask | null | undefined; versions: ContractGenerationVersion[]; reviewPending: boolean; onReview: () => void; onAcceptRisk: (index: number) => void; onIgnoreRisk: (index: number) => void; onRestoreVersion: (versionId: string) => void }) {
    return (
        <aside className="contract-insight-panel contract-panel">
            <div className="contract-panel-head">
                <div><h2>风险与版本</h2><p>查看评分、风险建议和历史版本。</p></div>
                <button className="contract-button" onClick={onReview} disabled={!task || reviewPending || isBusyStatus(task.status)}>审查</button>
            </div>
            <ScoreCard task={task ?? null} />
            <div className="contract-risk-list">
                {(task?.riskFindings ?? []).slice(0, 6).map((risk, index) => {
                    const action = task?.riskActions?.[getRiskKey(risk, index)]?.status;
                    return <RiskItem key={`${risk.sectionTitle}-${index}`} risk={risk} action={action} onAccept={() => onAcceptRisk(index)} onIgnore={() => onIgnoreRisk(index)} />;
                })}
                {!(task?.riskFindings ?? []).length && <div className="contract-empty">暂无风险结果。</div>}
            </div>
            <InsightSection title="法律术语">
                {(task?.legalTerms ?? []).slice(0, 5).map((term) => (
                    <details key={term.term} className="contract-detail-item">
                        <summary>{term.term}</summary>
                        <p>{term.explanation}</p>
                    </details>
                ))}
                {!(task?.legalTerms ?? []).length && <div className="contract-empty">暂无术语解释。</div>}
            </InsightSection>
            <InsightSection title="版本历史">
                {versions.slice(0, 6).map((version) => (
                    <button key={version.id} className="contract-version-item" onClick={() => onRestoreVersion(version.id)} type="button">
                        <strong>v{version.versionNo} / {version.changeSummary || version.changeType}</strong>
                        <span>{new Date(version.createdAt).toLocaleString()}</span>
                    </button>
                ))}
                {versions.length === 0 && <div className="contract-empty">暂无版本记录。</div>}
            </InsightSection>
        </aside>
    );
}

function RiskItem({ risk, action, onAccept, onIgnore }: { risk: ContractRiskFinding; action?: "accepted" | "ignored"; onAccept: () => void; onIgnore: () => void }) {
    return (
        <article className={`contract-risk-item ${risk.level}`}>
            <div>
                <span>{riskLevelText(risk.level)}</span>
                <strong>{risk.sectionTitle}</strong>
            </div>
            <p>{risk.issue}</p>
            <small>建议：{risk.suggestion}</small>
            {action && <em>{action === "accepted" ? "已采纳" : "已忽略"}</em>}
            <div>
                <button onClick={onAccept} disabled={action === "accepted"}>采纳</button>
                <button onClick={onIgnore} disabled={action === "ignored"}>忽略</button>
            </div>
        </article>
    );
}

function InsightSection({ title, children }: { title: string; children: React.ReactNode }) {
    return <section className="contract-insight-section"><h3>{title}</h3>{children}</section>;
}

function TemplateForm({ template, variables, errors, onChange }: { template: ContractTemplate; variables: Record<string, string>; errors: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
    return (
        <div className="contract-template-form">
            <div className="contract-form-grid">
                {template.fields.map((field) => (
                    <label key={field.key} className={`contract-field ${field.type === "textarea" ? "is-wide" : ""}`}>
                        <span>{field.label}{field.required ? " *" : ""}</span>
                        {field.type === "textarea" ? (
                            <textarea value={variables[field.key] ?? ""} onChange={(event) => onChange({ ...variables, [field.key]: event.target.value })} placeholder={field.placeholder} />
                        ) : field.type === "select" ? (
                            <select value={variables[field.key] ?? ""} onChange={(event) => onChange({ ...variables, [field.key]: event.target.value })}>
                                <option value="">请选择</option>
                                {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        ) : (
                            <input type={field.type} value={variables[field.key] ?? ""} onChange={(event) => onChange({ ...variables, [field.key]: event.target.value })} placeholder={field.placeholder} />
                        )}
                        {errors[field.key] && <em>{errors[field.key]}</em>}
                    </label>
                ))}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return <label className="contract-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function ModelStatus({ config }: { config?: ContractGenerationConfig }) {
    return <span className={`contract-status-pill ${config?.configured ? "is-success" : "is-danger"}`}>{config?.configured && config.model ? `${config.model.providerName} / ${config.model.name}` : "模型未配置"}</span>;
}

function ScoreCard({ task }: { task: ContractGenerationTask | null }) {
    const score = task?.score;
    return (
        <div className="contract-score-card">
            <strong>{score?.overall ?? "--"}</strong>
            <span>合同评分</span>
            <p>完整性 {score?.completeness ?? "--"} / 风险控制 {score?.riskControl ?? "--"} / 清晰度 {score?.clarity ?? "--"}</p>
            {!!score?.missingItems?.length && <p>缺失项：{score.missingItems.join("、")}</p>}
        </div>
    );
}

function validateTemplateFields(template: ContractTemplate, variables: Record<string, string>) {
    return template.fields.reduce<Record<string, string>>((errors, field) => {
        if (field.required && !String(variables[field.key] ?? "").trim()) errors[field.key] = `请填写${field.label}`;
        return errors;
    }, {});
}

function fillExample(template: ContractTemplate | undefined, setVariables: (value: Record<string, string>) => void, setTitle: (value: string) => void, setPrompt: (value: string) => void) {
    if (!template) return;
    const values = template.fields.reduce<Record<string, string>>((accumulator, field) => {
        accumulator[field.key] = exampleValue(field.key, field.label, field.options);
        return accumulator;
    }, {});
    setVariables(values);
    setTitle(`${template.name}（示例）`);
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

function getRiskKey(risk: { sectionTitle: string; issue: string }, index: number) {
    return `${index}:${risk.sectionTitle}:${risk.issue}`;
}

function statusText(status: string) {
    return { pending: "等待中", processing: "生成中", draft: "草稿", reviewing: "审查中", exporting: "导出中", success: "已导出", failed: "失败", export_failed: "导出失败" }[status] ?? status;
}

function riskLevelText(level: string) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level] ?? level;
}

function riskForSection(task: ContractGenerationTask | null, sectionTitle: string) {
    return task?.riskFindings?.find((risk) => risk.sectionTitle.includes(sectionTitle) || sectionTitle.includes(risk.sectionTitle));
}

function isBusyStatus(status: ContractGenerationStatus | string) {
    return ["pending", "processing", "reviewing", "exporting"].includes(status);
}

function statusClass(status: string) {
    if (["failed", "export_failed"].includes(status)) return "is-danger";
    if (["pending", "processing", "reviewing", "exporting"].includes(status)) return "is-warning";
    return "is-success";
}

function primaryActionText({ mode, activeTask, dirty }: { mode: "draft" | "review"; activeTask?: ContractGenerationTask | null; dirty: boolean }) {
    if (!activeTask) return mode === "review" ? "开始审查" : "生成合同";
    if (isBusyStatus(activeTask.status)) return `${statusText(activeTask.status)}...`;
    if (dirty) return "保存修改";
    if (activeTask.riskFindings.length > 0) return "导出 Word";
    return "风险审查";
}
