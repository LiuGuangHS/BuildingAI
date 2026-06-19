import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { uploadFile } from "@buildingai/services/shared";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ContractDocumentWorkbench } from "../components/contract-editor/ContractDocumentEditor";
import { useContractGenerationConfigQuery, useContractTaskDetailQuery, useContractTasksQuery, useContractTemplatesQuery, useContractVersionsQuery, useExportContractMutation, useGenerateContractMutation, useRestoreContractVersionMutation, useReviewContractMutation, useReviewUploadedContractMutation, useRewriteContractClauseMutation, useUpdateContractContentMutation, useUpdateRiskActionMutation } from "../services/web";
import type { ContractGenerationConfig, ContractGenerationStatus, ContractGenerationTask, ContractSection, ContractTemplate, ContractTemplateField } from "../services/types";

const stanceOptions = [
    { value: "neutral", label: "中立平衡" },
    { value: "favor_party_a", label: "偏甲方" },
    { value: "favor_party_b", label: "偏乙方" },
    { value: "strict", label: "更严格" },
    { value: "friendly", label: "更友好" },
] as const;

const exportTypeOptions = [
    { value: "contract", label: "正式合同" },
    { value: "contract_with_report", label: "合同 + 风险报告" },
    { value: "risk_report", label: "仅风险报告" },
] as const;

const EMPTY_SELECT_VALUE = "__empty__";
type RewriteMode = "reduce_risk" | "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly";

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
    const [draftSections, setDraftSections] = useState<ContractSection[]>([]);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [rewriteMode, setRewriteMode] = useState<RewriteMode>("reduce_risk");
    const [rewritePreview, setRewritePreview] = useState<{ content: string; reason: string } | null>(null);
    const [message, setMessage] = useState("");
    const [recentCollapsed, setRecentCollapsed] = useState(false);
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
        if (!config?.configured) {
            setMessage("当前未配置可用模型，暂不能生成合同。请联系管理员在插件后台选择启用模型。");
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
        if (!config?.configured) {
            setMessage("当前未配置可用模型，暂不能审查合同。请联系管理员在插件后台选择启用模型。");
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

    return (
        <main className="contract-workbench">
            <Card className="contract-workbench-header" size="sm">
                <div className="contract-header-copy">
                    <p>合同工作台</p>
                    <h1>合同起草与风险审查</h1>
                    <span className="contract-flow-note">模板字段 / 文档编辑 / 风险建议 / Word 导出</span>
                </div>
                <div className="contract-header-meta">
                    <div className="contract-header-status">
                        <ModelStatus config={config} />
                        <TaskStatusBadge status={activeTask?.status ?? "draft"} />
                        {dirty && <Badge variant="outline" className="contract-badge-warning">{activeTask ? "有未保存修改" : "草稿已编辑"}</Badge>}
                    </div>
                    <Button className="contract-header-primary" onClick={handlePrimaryAction} disabled={isBusy || primaryActionPending} loading={primaryActionPending}>
                        {primaryActionText({ mode, activeTask, dirty })}
                    </Button>
                </div>
            </Card>

            {message && <div className="contract-notice">{message}</div>}

            <section className="contract-workbench-grid">
                <aside className="contract-control-rail">
                    <Card className="contract-task-card" size="sm">
                        <CardHeader>
                            <CardTitle>任务信息</CardTitle>
                            <CardDescription>填写合同信息，正文会在右侧形成草稿骨架。</CardDescription>
                            <CardAction>
                                <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="contract-mode-tabs">
                                    <TabsList>
                                        <TabsTrigger value="draft">起草</TabsTrigger>
                                        <TabsTrigger value="review">审查</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            {selectedTemplate && <TemplateSummary template={selectedTemplate} />}
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
                            <div className="contract-submit-panel">
                                <span>提交后按当前模型配置预扣积分，失败会按账务事实退款。</span>
                                <Button onClick={handlePrimaryAction} disabled={isBusy || primaryActionPending} loading={primaryActionPending}>
                                    {primaryActionText({ mode, activeTask, dirty })}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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
                </aside>

                <ContractDocumentWorkbench
                    activeTask={activeTask}
                    template={selectedTemplate}
                    title={title}
                    variables={variables}
                    sections={activeTask ? sections : draftSections}
                    documentRevision={documentRevision}
                    selectedSectionIndex={selectedSectionIndex}
                    draftEditable={!activeTask}
                    rewriteMode={rewriteMode}
                    rewritePreview={rewritePreview}
                    rewritePending={rewriteMutation.isPending}
                    versions={versions}
                    reviewPending={reviewMutation.isPending}
                    exportType={exportType}
                    dirty={dirty}
                    canSave={canSave}
                    canReview={canReview}
                    canExport={canExport}
                    onSelectSection={setSelectedSectionIndex}
                    onSectionsChange={replaceSections}
                    onRewriteModeChange={setRewriteMode}
                    onRewrite={handleRewrite}
                    onApplyRewrite={applyRewritePreview}
                    onCancelRewrite={() => setRewritePreview(null)}
                    onSave={handleSave}
                    onReview={handleReview}
                    onExport={handleExport}
                    onAcceptRisk={handleAcceptRisk}
                    onIgnoreRisk={handleIgnoreRisk}
                    onRestoreVersion={handleRestoreVersion}
                />
            </section>
        </main>
    );
}

function TemplateSummary({ template }: { template: ContractTemplate }) {
    return (
        <div className="contract-template-summary">
            <div>
                <span>当前模板</span>
                <strong>{template.name}</strong>
            </div>
            <dl>
                <div>
                    <dt>行业</dt>
                    <dd>{template.industry}</dd>
                </div>
                <div>
                    <dt>类型</dt>
                    <dd>{template.contractType}</dd>
                </div>
                <div>
                    <dt>字段</dt>
                    <dd>{template.fields.length}</dd>
                </div>
                <div>
                    <dt>条款</dt>
                    <dd>{template.defaultSections.length}</dd>
                </div>
            </dl>
        </div>
    );
}

function TemplateSidebar({ templates, keyword, selectedTemplate, tasks, recentCollapsed, onKeywordChange, onSelectTemplate, onSelectTask, onToggleRecent }: { templates: ContractTemplate[]; keyword: string; selectedTemplate?: ContractTemplate; tasks: ContractGenerationTask[]; recentCollapsed: boolean; onKeywordChange: (value: string) => void; onSelectTemplate: (template: ContractTemplate) => void; onSelectTask: (task: ContractGenerationTask) => void; onToggleRecent: () => void }) {
    return (
        <Card className="contract-sidebar" size="sm">
            <CardHeader>
                <CardTitle>模板</CardTitle>
                <CardDescription>选择常用合同类型</CardDescription>
            </CardHeader>
            <CardContent>
                <Input value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="搜索模板、行业或类型" />
                <div className="contract-template-list">
                    {templates.map((template) => (
                        <Button
                            key={template.id}
                            className={cn("contract-template-item", selectedTemplate?.id === template.id && "is-active")}
                            onClick={() => onSelectTemplate(template)}
                            type="button"
                            variant="outline"
                        >
                            <strong>{template.name}</strong>
                            <span>{template.industry} / {template.contractType}</span>
                            {template.description && <em>{template.description}</em>}
                        </Button>
                    ))}
                    {templates.length === 0 && <div className="contract-empty">没有匹配模板。</div>}
                </div>
                <div className="contract-sidebar-section">
                    <div className="contract-panel-head is-compact">
                        <div><h2>最近合同</h2><p>{tasks.length} 个任务</p></div>
                        <Button variant="ghost" size="sm" onClick={onToggleRecent} type="button">{recentCollapsed ? "展开" : "收起"}</Button>
                    </div>
                    {!recentCollapsed && (
                        <div className="contract-task-list">
                            {tasks.map((task) => (
                                <Button key={task.id} className="contract-task-item" onClick={() => onSelectTask(task)} type="button" variant="outline">
                                    <strong>{task.title}</strong>
                                    <span>{statusText(task.status)} / {new Date(task.createdAt).toLocaleDateString()}</span>
                                </Button>
                            ))}
                            {tasks.length === 0 && <div className="contract-empty">暂无最近合同。</div>}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
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
            <div className="contract-setup-head">
                <div>
                    <h3>基础信息</h3>
                    <p>先把合同标题、立场和交付类型定下来，后面的条款会跟着收敛。</p>
                </div>
                <Button variant="outline" onClick={props.onFillExample} type="button">填入示例</Button>
            </div>

            <div className="contract-form-grid contract-setup-grid">
                <Field label="合同标题" value={props.title} onChange={props.onTitleChange} />
                <SelectField label="合同立场" value={props.stance} options={stanceOptions} onChange={(value) => props.onStanceChange(value as typeof props.stance)} />
                <SelectField label="导出类型" value={props.exportType} options={exportTypeOptions} onChange={(value) => props.onExportTypeChange(value as typeof props.exportType)} />
            </div>

            {props.mode === "draft" && props.selectedTemplate && (
                <section className="contract-setup-section">
                    <div className="contract-setup-head is-sub">
                        <div>
                            <h3>模板字段</h3>
                            <p>这些变量会直接写入合同正文，建议先补齐。</p>
                        </div>
                    </div>
                    <TemplateForm template={props.selectedTemplate} variables={props.variables} errors={props.errors} onChange={props.onVariablesChange} />
                    <FieldShell label="补充要求" wide>
                        <Textarea value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder="例如：违约责任更严格、付款节点按 30/40/30、争议解决放在上海..." />
                    </FieldShell>
                </section>
            )}

            {props.mode === "review" && (
                <div className="contract-upload-panel contract-setup-section">
                    <div className="contract-setup-head is-sub">
                        <div>
                            <h3>上传已有合同</h3>
                            <p>支持 Word、PDF 和文本文件，上传后会先解析再进入审查。</p>
                        </div>
                    </div>
                    <FieldShell label="已有合同文件" wide>
                        <Input type="file" accept=".doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => props.onReviewFileChange(event.target.files?.[0] ?? null)} />
                        <small>{props.reviewFile ? `已选择：${props.reviewFile.name}` : "支持 Word/PDF/文本等可解析文件，文件会先上传到平台后再审查。"}</small>
                    </FieldShell>
                </div>
            )}
        </section>
    );
}

function TemplateForm({ template, variables, errors, onChange }: { template: ContractTemplate; variables: Record<string, string>; errors: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
    const fieldGroups = groupTemplateFields(template.fields);
    return (
        <div className="contract-template-form">
            {fieldGroups.map((group) => (
                <section key={group.title} className="contract-field-group">
                    <div className="contract-field-group-head">
                        <h4>{group.title}</h4>
                        <p>{group.description}</p>
                    </div>
                    <div className="contract-form-grid">
                        {group.fields.map((field) => (
                            <TemplateField key={field.key} field={field} value={variables[field.key] ?? ""} error={errors[field.key]} onChange={(value) => onChange({ ...variables, [field.key]: value })} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function TemplateField({ field, value, error, onChange }: { field: ContractTemplateField; value: string; error?: string; onChange: (value: string) => void }) {
    return (
        <FieldShell label={`${field.label}${field.required ? " *" : ""}`} error={error} wide={field.type === "textarea"}>
            {field.type === "textarea" ? (
                <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
            ) : field.type === "select" ? (
                <Select value={value || EMPTY_SELECT_VALUE} onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>请选择</SelectItem>
                        {(field.options ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : (
                <Input type={field.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
            )}
        </FieldShell>
    );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return (
        <FieldShell label={label}>
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        </FieldShell>
    );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
    return (
        <FieldShell label={label}>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </FieldShell>
    );
}

function FieldShell({ label, children, error, wide }: { label: string; children: ReactNode; error?: string; wide?: boolean }) {
    return (
        <div className={cn("contract-field", wide && "is-wide")}>
            <Label>{label}</Label>
            {children}
            {error && <em>{error}</em>}
        </div>
    );
}

function ModelStatus({ config }: { config?: ContractGenerationConfig }) {
    return <Badge variant={config?.configured ? "default" : "destructive"}>{config?.configured && config.model ? `${config.model.providerName} / ${config.model.name}` : "模型未配置"}</Badge>;
}

function TaskStatusBadge({ status }: { status: ContractGenerationStatus | "draft" }) {
    const variant = ["failed", "export_failed"].includes(status) ? "destructive" : ["pending", "processing", "reviewing", "exporting"].includes(status) ? "secondary" : "outline";
    return <Badge variant={variant}>{statusText(status)}</Badge>;
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
    if (!template) return;
    const values = template.fields.reduce<Record<string, string>>((accumulator, field) => {
        accumulator[field.key] = exampleValue(field.key, field.label, field.options);
        return accumulator;
    }, {});
    setVariables(values);
    setTitle(`${template.name}（示例）`);
    setPrompt("请强化付款节点、验收标准和违约责任，条款表达保持专业、清晰、可执行。");
}

function groupTemplateFields(fields: ContractTemplateField[]) {
    const groups = [
        { title: "当事方", description: "明确合同双方主体信息。", fields: [] as ContractTemplateField[], match: (field: ContractTemplateField) => /甲方|乙方|丙方|委托方|受托方|买方|卖方|出租方|承租方|雇主|劳动者|供应商|客户|party|buyer|seller|tenant|lessor|employer/i.test(`${field.key} ${field.label}`) },
        { title: "履行与费用", description: "确认时间、周期、金额和付款安排。", fields: [] as ContractTemplateField[], match: (field: ContractTemplateField) => /日期|期限|周期|费用|金额|价格|租金|报酬|付款|支付|结算|验收|date|term|period|fee|price|amount|payment|rent/i.test(`${field.key} ${field.label}`) },
        { title: "服务与争议", description: "描述服务内容、交付范围和争议解决方式。", fields: [] as ContractTemplateField[], match: (field: ContractTemplateField) => /服务|内容|范围|交付|职责|标准|地点|地址|争议|法院|仲裁|保密|违约|service|scope|deliver|address|dispute|court|arbitration|confidential|breach/i.test(`${field.key} ${field.label}`) },
        { title: "其他信息", description: "补充模板所需的其他变量。", fields: [] as ContractTemplateField[], match: () => true },
    ];
    fields.forEach((field) => {
        const group = groups.find((item) => item.match(field)) ?? groups[groups.length - 1];
        group.fields.push(field);
    });
    return groups.filter((group) => group.fields.length > 0).map(({ match, ...group }) => group);
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

function isBusyStatus(status: ContractGenerationStatus | string) {
    return ["pending", "processing", "reviewing", "exporting"].includes(status);
}

function primaryActionText({ mode, activeTask, dirty }: { mode: "draft" | "review"; activeTask?: ContractGenerationTask | null; dirty: boolean }) {
    if (!activeTask) return mode === "review" ? "开始审查" : "生成合同";
    if (isBusyStatus(activeTask.status)) return `${statusText(activeTask.status)}...`;
    if (dirty) return "保存修改";
    if (activeTask.riskFindings.length > 0) return "导出 Word";
    return "风险审查";
}
