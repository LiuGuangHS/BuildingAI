import { useEffect, useState } from "react";
import { uploadFile } from "@buildingai/services/shared";

import { useContractGenerationConfigQuery, useContractTasksQuery, useContractTemplatesQuery, useContractVersionsQuery, useExportContractMutation, useGenerateContractMutation, useRestoreContractVersionMutation, useReviewContractMutation, useReviewUploadedContractMutation, useRewriteContractClauseMutation, useUpdateContractContentMutation, useUpdateRiskActionMutation } from "../services/web";
import type { ContractGenerationConfig, ContractGenerationTask, ContractSection, ContractTemplate } from "../services/types";

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
    const { data: taskPage } = useContractTasksQuery({ page: 1, pageSize: 12 });
    const generateMutation = useGenerateContractMutation();
    const reviewUploadMutation = useReviewUploadedContractMutation();
    const reviewMutation = useReviewContractMutation();
    const rewriteMutation = useRewriteContractClauseMutation();
    const updateMutation = useUpdateContractContentMutation();
    const updateRiskActionMutation = useUpdateRiskActionMutation();
    const restoreVersionMutation = useRestoreContractVersionMutation();
    const exportMutation = useExportContractMutation();

    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [mode, setMode] = useState<"draft" | "review">("draft");
    const [title, setTitle] = useState("服务合同");
    const [reviewFile, setReviewFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState("");
    const [stance, setStance] = useState<(typeof stanceOptions)[number]["value"]>("neutral");
    const [exportType, setExportType] = useState<"contract" | "contract_with_report" | "risk_report">("contract");
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [activeTask, setActiveTask] = useState<ContractGenerationTask | null>(null);
    const [sections, setSections] = useState<ContractSection[]>([]);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
    const [rewriteMode, setRewriteMode] = useState<(typeof rewriteModes)[number]["value"]>("reduce_risk");
    const [rewritePreview, setRewritePreview] = useState<{ content: string; reason: string } | null>(null);
    const [message, setMessage] = useState("");
    const { data: versions = [] } = useContractVersionsQuery(activeTask?.id);

    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

    useEffect(() => {
        if (!selectedTemplateId && templates[0]) {
            setSelectedTemplateId(templates[0].id);
            setTitle(templates[0].name);
        }
    }, [selectedTemplateId, templates]);

    useEffect(() => {
        if (activeTask) {
            setSections(activeTask.sections ?? []);
            setSelectedSectionIndex(0);
        }
    }, [activeTask]);

    async function handleGenerate() {
        if (!config?.configured) {
            setMessage("AI 合同插件尚未配置固定模型，请联系管理员在插件后台配置。 ");
            return;
        }
        if (!selectedTemplate) return;
        const errors = validateTemplateFields(selectedTemplate, variables);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            setMessage("请先补全必填合同信息。 ");
            return;
        }
        setMessage("正在生成合同...");
        try {
            const task = await generateMutation.mutateAsync({ title, templateId: selectedTemplate.id, contractType: selectedTemplate.contractType, industry: selectedTemplate.industry, variables, prompt, language: "zh-CN", stance });
            setActiveTask(task);
            setMessage("合同已生成，可继续编辑、审查或导出。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "生成失败");
        }
    }

    async function handleReviewUpload() {
        if (!config?.configured) {
            setMessage("AI 合同插件尚未配置固定模型，请联系管理员在插件后台配置。 ");
            return;
        }
        if (!reviewFile) {
            setMessage("请上传已有合同文件。 ");
            return;
        }
        setMessage("正在解析并审查已有合同...");
        try {
            const uploaded = await uploadFile(reviewFile, { description: "AI合同审查文件", extensionId: "echoflow-contract-generation" });
            if (!uploaded.id) throw new Error("平台上传未返回 fileId，请检查存储配置");
            const task = await reviewUploadMutation.mutateAsync({ title: title.trim() || undefined, fileId: uploaded.id, contractType: selectedTemplate?.contractType, industry: selectedTemplate?.industry, stance });
            setActiveTask(task);
            setMessage("已有合同审查完成，可继续处理风险、编辑或导出。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "审查失败");
        }
    }

    async function handleSave() {
        if (!activeTask) return;
        setMessage("正在保存修改...");
        try {
            const task = await updateMutation.mutateAsync({ taskId: activeTask.id, params: { title: activeTask.title, summary: activeTask.summary ?? undefined, sections } });
            setActiveTask(task);
            setMessage("修改已保存。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    async function handleReview() {
        if (!activeTask) return;
        setMessage("正在审查合同风险...");
        try {
            const task = await reviewMutation.mutateAsync(activeTask.id);
            setActiveTask(task);
            setMessage("风险审查已更新。 ");
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
            setMessage(`已生成改写建议：${result.reason}`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "优化失败");
        }
    }

    function applyRewritePreview() {
        if (!rewritePreview) return;
        setSections((items) => items.map((item, index) => (index === selectedSectionIndex ? { ...item, content: rewritePreview.content } : item)));
        setRewritePreview(null);
        setMessage("已应用改写建议，请保存修改。 ");
    }

    async function handleExport() {
        if (!activeTask) return;
        setMessage("正在导出 Word 合同...");
        try {
            const task = await exportMutation.mutateAsync({ taskId: activeTask.id, params: { exportType } });
            setActiveTask(task);
            setMessage("导出完成。 ");
            if (task.resultUrl) window.open(task.resultUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "导出失败");
        }
    }

    async function handleAcceptRisk(index: number) {
        if (!activeTask) return;
        const risk = activeTask.riskFindings?.[index];
        if (!risk?.replacementText) {
            setMessage("该风险建议没有可直接替换的条款文本。 ");
            return;
        }
        const sectionIndex = sections.findIndex((section) => section.title.includes(risk.sectionTitle) || risk.sectionTitle.includes(section.title));
        if (sectionIndex < 0) {
            setMessage("未找到对应条款，请手动复制建议文本。 ");
            return;
        }
        const nextSections = sections.map((item, itemIndex) => (itemIndex === sectionIndex ? { ...item, content: risk.replacementText! } : item));
        try {
            const task = await updateRiskActionMutation.mutateAsync({ taskId: activeTask.id, params: { riskKey: getRiskKey(risk, index), status: "accepted", sections: nextSections } });
            setSections(nextSections);
            setSelectedSectionIndex(sectionIndex);
            setActiveTask(task);
            setMessage("已采纳风险建议并记录版本。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "采纳失败");
        }
    }

    async function handleIgnoreRisk(index: number) {
        const risk = activeTask?.riskFindings?.[index];
        if (!risk || !activeTask) return;
        try {
            const task = await updateRiskActionMutation.mutateAsync({ taskId: activeTask.id, params: { riskKey: getRiskKey(risk, index), status: "ignored" } });
            setActiveTask(task);
            setMessage("已忽略风险建议。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "忽略失败");
        }
    }

    async function handleRestoreVersion(versionId: string) {
        if (!activeTask) return;
        try {
            const task = await restoreVersionMutation.mutateAsync({ taskId: activeTask.id, versionId });
            setActiveTask(task);
            setMessage("已恢复历史版本。 ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "恢复失败");
        }
    }

    return (
        <main className="contract-shell">
            <style>{contractStyles}</style>
            <section className="contract-page">
                <header className="contract-topbar">
                    <div className="contract-brand"><span className="brand-mark">§</span><div><strong>EchoFlowAI</strong><span>AI Legal Workspace</span></div></div>
                    <div className="contract-titleline"><h1>{activeTask?.title || title || "AI合同工作台"}</h1><span className="status-chip">{statusText(activeTask?.status || "draft")}</span>{activeTask && <span className="muted-chip">完整度 {activeTask.score?.overall ?? "--"}/100</span>}</div>
                    <div className="top-actions"><button className="ghost-btn" onClick={() => fillExample(selectedTemplate, setVariables, setTitle, setPrompt)}>填入示例</button><button className="primary-btn" onClick={mode === "draft" ? handleGenerate : handleReviewUpload} disabled={generateMutation.isPending || reviewUploadMutation.isPending}>{mode === "draft" ? "生成 / 更新" : "审查合同"}</button></div>
                </header>

                {message && <div className="notice-card">{message}</div>}

                <section className="template-strip card-shell">
                    <div className="section-head"><div><h2>模板库</h2><p>选择常用合同模板，快速开始起草或审查。</p></div><button className="link-btn" type="button">查看全部 →</button></div>
                    <div className="template-row">
                        {templates.map((template) => <button key={template.id} className={`template-card ${selectedTemplate?.id === template.id ? "active" : ""}`} onClick={() => { setSelectedTemplateId(template.id); setTitle(template.name); setVariables({}); }} type="button"><span className="doc-icon">▣</span><strong>{template.name}</strong><small>{template.industry}</small></button>)}
                    </div>
                </section>

                <section className="recent-strip card-shell">
                    <div className="section-head compact"><h2>最近合同</h2><button className="link-btn" type="button">收起</button></div>
                    <div className="recent-row">{(taskPage?.items ?? []).slice(0, 6).map((task) => <button key={task.id} className="recent-card" onClick={() => setActiveTask(task)} type="button"><span className="doc-mini">▦</span><strong>{task.title}</strong><small>{statusText(task.status)} · {new Date(task.createdAt).toLocaleDateString()}</small></button>)}</div>
                </section>

                <section className="workspace-grid">
                    <article className="editor-card card-shell">
                        <div className="workspace-head"><div><h2>合同工作区</h2><p>{selectedTemplate?.description || "填写结构化信息后生成合同条款，并继续审查风险。"}</p></div><div className="mode-toggle"><button className={mode === "draft" ? "active" : ""} onClick={() => setMode("draft")} type="button">起草</button><button className={mode === "review" ? "active" : ""} onClick={() => setMode("review")} type="button">审查</button></div></div>

                        <div className="form-grid top-fields"><Field label="合同标题" value={title} onChange={setTitle} /><FixedModelStatus config={config} /><label className="field-wrap"><span>合同立场</span><select value={stance} onChange={(event) => setStance(event.target.value as typeof stance)}>{stanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-wrap"><span>导出类型</span><select value={exportType} onChange={(event) => setExportType(event.target.value as typeof exportType)}><option value="contract">正式合同</option><option value="contract_with_report">合同 + 风险报告</option><option value="risk_report">仅风险报告</option></select></label></div>
                        <div className="legal-tip">使用说明：用户可基于模板起草新合同，也可上传已有合同文件进行审查。生成内容仅供参考，不构成法律意见。</div>
                        {selectedTemplate && <TemplateForm template={selectedTemplate} variables={variables} errors={fieldErrors} onChange={(nextVariables) => { setVariables(nextVariables); setFieldErrors(validateTemplateFields(selectedTemplate, nextVariables)); }} />}
                        {mode === "review" && <div className="field-wrap full-field"><span>已有合同文件 *</span><input type="file" accept=".doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => setReviewFile(event.target.files?.[0] ?? null)} /><small>{reviewFile ? `已选择：${reviewFile.name}` : "支持 Word/PDF/文本等可解析文件，文件会先上传到平台后再审查。"} </small></div>}
                        {mode === "draft" && <label className="field-wrap full-field"><span>补充要求</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：违约责任更严格、付款节点按 30/40/30、争议解决放在上海..." /></label>}

                        <div className="clause-workbench">
                            <aside className="clause-nav"><div className="mini-title">条款</div>{sections.map((section, index) => <button key={section.id ?? index} className={index === selectedSectionIndex ? "active" : ""} onClick={() => setSelectedSectionIndex(index)} type="button"><span>{index + 1}.</span>{section.title}<em>{riskForSection(activeTask, section.title) ? "!" : "✓"}</em></button>)}{!sections.length && <div className="empty-mini">生成合同后显示条款目录。</div>}</aside>
                            <section className="clause-editor">
                                {sections[selectedSectionIndex] ? <><div className="editor-toolbar"><strong>{selectedSectionIndex + 1}. {sections[selectedSectionIndex].title}</strong><button className="ghost-btn small" onClick={handleRewrite} disabled={!activeTask || rewriteMutation.isPending}>AI 优化</button></div><input value={sections[selectedSectionIndex].title} onChange={(event) => updateSection(selectedSectionIndex, { title: event.target.value }, setSections)} /><textarea value={sections[selectedSectionIndex].content} onChange={(event) => updateSection(selectedSectionIndex, { content: event.target.value }, setSections)} /></> : <div className="empty-state">选择模板并生成合同后，可在这里逐条编辑条款。</div>}
                            </section>
                            <aside className="ai-suggestion"><h3>AI 条款助手</h3><select value={rewriteMode} onChange={(event) => setRewriteMode(event.target.value as typeof rewriteMode)}>{rewriteModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select>{rewritePreview ? <div className="suggestion-card"><strong>改写建议</strong><p>{rewritePreview.reason}</p><p>{rewritePreview.content}</p><button className="primary-btn" onClick={applyRewritePreview}>应用改写</button><button className="ghost-btn" onClick={() => setRewritePreview(null)}>取消</button></div> : <p>选择当前条款后，可生成更严谨、更友好或偏向特定立场的改写建议。</p>}</aside>
                        </div>
                    </article>

                    <aside className="risk-card card-shell">
                        <div className="section-head"><div><h2>风险智能</h2><p>基于当前条款给出风险摘要与处理建议。</p></div><button className="icon-btn" onClick={handleReview} disabled={!activeTask || reviewMutation.isPending} type="button">↻</button></div>
                        <ScoreCard task={activeTask} />
                        <div className="risk-list">{(activeTask?.riskFindings ?? []).slice(0, 6).map((risk, index) => { const action = activeTask?.riskActions?.[getRiskKey(risk, index)]?.status; return <article key={`${risk.sectionTitle}-${index}`} className={`risk-item ${risk.level}`}><div><span>{riskLevelText(risk.level)}</span><strong>{risk.sectionTitle}</strong></div><p>{risk.issue}</p><small>建议：{risk.suggestion}</small>{action && <em>{action === "accepted" ? "已采纳" : "已忽略"}</em>}<div><button onClick={() => handleAcceptRisk(index)} disabled={action === "accepted"}>采纳</button><button onClick={() => handleIgnoreRisk(index)} disabled={action === "ignored"}>忽略</button></div></article>; })}{!(activeTask?.riskFindings ?? []).length && <div className="empty-mini">暂无风险结果，生成合同后可运行风险审查。</div>}</div>
                        <div className="side-section"><h3>法律术语</h3>{(activeTask?.legalTerms ?? []).slice(0, 5).map((term) => <details key={term.term}><summary>{term.term}</summary><p>{term.explanation}</p></details>)}</div>
                        <div className="side-section"><h3>版本历史</h3>{versions.slice(0, 5).map((version) => <button key={version.id} className="version-card" onClick={() => handleRestoreVersion(version.id)} type="button"><strong>v{version.versionNo}</strong><span>{version.changeSummary || version.changeType}</span><small>{new Date(version.createdAt).toLocaleString()}</small></button>)}</div>
                    </aside>
                </section>
            </section>

            <div className="contract-actionbar"><button className="ghost-btn" onClick={handleSave} disabled={!activeTask || updateMutation.isPending}>保存草稿</button><button className="ghost-btn" onClick={handleReview} disabled={!activeTask || reviewMutation.isPending}>风险审查</button><button className="ghost-btn" onClick={handleExport} disabled={!activeTask || exportMutation.isPending}>导出 Word</button><button className="primary-btn" onClick={mode === "draft" ? handleGenerate : handleReviewUpload} disabled={generateMutation.isPending || reviewUploadMutation.isPending}>继续</button></div>
        </main>
    );
}

function FixedModelStatus({ config }: { config?: ContractGenerationConfig }) {
    return <label className="model-status-field"><span>管理员固定模型</span><div className={config?.configured ? "" : "missing"}>{config?.configured && config.model ? `${config.model.providerName} / ${config.model.name}` : "未配置，请联系管理员"}</div></label>;
}

function TemplateForm({ template, variables, errors, onChange }: { template: ContractTemplate; variables: Record<string, string>; errors: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
    return (
            <div className="template-form">
            <p>{template.description}</p>
            <div className="template-form-grid">
                {template.fields.map((field) => (
                    <label key={field.key} className={field.type === "textarea" ? "wide" : undefined}>
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return <label className="field-wrap"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function ScoreCard({ task }: { task: ContractGenerationTask | null }) {
    const score = task?.score;
    return (
        <div className="score-card-inner">
            <div>{score?.overall ?? "--"}</div>
            <p>合同完整度评分</p>
            <small>完整性：{score?.completeness ?? "--"} · 风险控制：{score?.riskControl ?? "--"} · 清晰度：{score?.clarity ?? "--"}</small>
            {!!score?.missingItems?.length && <small>缺失项：{score.missingItems.join("、")}</small>}
        </div>
    );
}

function updateSection(index: number, patch: Partial<ContractSection>, setSections: (updater: (items: ContractSection[]) => ContractSection[]) => void) {
    setSections((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
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

const contractStyles = `
* { box-sizing: border-box; }
body { margin: 0; }
.contract-shell {
    --ef-bg: var(--background, #f6f8fc);
    --ef-fg: var(--foreground, #0f172a);
    --ef-card: var(--card, #ffffff);
    --ef-card-fg: var(--card-foreground, #0f172a);
    --ef-muted: var(--muted, #f1f5f9);
    --ef-muted-fg: var(--muted-foreground, #64748b);
    --ef-primary: var(--primary, #0f62fe);
    --ef-primary-fg: var(--primary-foreground, #ffffff);
    --ef-border: var(--border, #dbe3ef);
    --legal-navy: #071a3a;
    --legal-gold: #d89c32;
    --risk-high: #dc2626;
    --risk-medium: #d97706;
    --risk-low: #16a34a;
    min-height: 100vh;
    padding-bottom: 128px;
    background: radial-gradient(circle at top left, color-mix(in oklab, var(--ef-primary) 12%, transparent), transparent 32%), var(--ef-bg);
    color: var(--ef-fg);
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.dark .contract-shell { --ef-bg: #08111f; --ef-card: #0f1b2d; --ef-card-fg: #eef4ff; --ef-border: rgba(148, 163, 184, .22); --ef-muted: rgba(148, 163, 184, .12); --ef-muted-fg: #9fb0c8; }
.contract-page { width: min(1440px, 100%); margin: 0 auto; padding: 18px; }
.card-shell { border: 1px solid var(--ef-border); border-radius: 22px; background: color-mix(in oklab, var(--ef-card) 96%, transparent); box-shadow: 0 20px 55px rgba(15, 23, 42, .08); }
.contract-topbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 18px; border: 1px solid var(--ef-border); border-radius: 26px; padding: 16px; background: linear-gradient(135deg, color-mix(in oklab, var(--legal-navy) 94%, var(--ef-primary)), color-mix(in oklab, var(--legal-navy) 74%, var(--ef-primary))); color: white; box-shadow: 0 24px 70px rgba(7, 26, 58, .22); }
.contract-brand { display: flex; align-items: center; gap: 12px; min-width: 190px; }
.brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(255,255,255,.28); border-radius: 14px; color: var(--legal-gold); font-size: 22px; font-weight: 900; }
.contract-brand strong, .contract-brand span { display: block; }
.contract-brand span:not(.brand-mark) { color: rgba(255,255,255,.68); font-size: 12px; }
.contract-titleline { min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.contract-titleline h1 { width: 100%; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(22px, 3vw, 34px); line-height: 1.1; }
.status-chip, .muted-chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
.status-chip { background: rgba(255,255,255,.16); color: white; }
.muted-chip { background: rgba(216,156,50,.16); color: #fdecc6; }
.top-actions, .contract-actionbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
button { font: inherit; }
.primary-btn, .ghost-btn, .link-btn, .icon-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px; padding: 10px 14px; font-weight: 850; transition: .18s ease; }
.primary-btn { border: 1px solid color-mix(in oklab, var(--ef-primary) 80%, #fff); background: var(--ef-primary); color: var(--ef-primary-fg); box-shadow: 0 14px 28px color-mix(in oklab, var(--ef-primary) 22%, transparent); }
.ghost-btn, .icon-btn { border: 1px solid var(--ef-border); background: var(--ef-card); color: var(--ef-fg); }
.ghost-btn.small { padding: 7px 10px; font-size: 12px; }
.link-btn { border: 0; background: transparent; color: var(--ef-primary); padding: 6px; }
.icon-btn { width: 38px; height: 38px; padding: 0; }
.primary-btn:disabled, .ghost-btn:disabled, .icon-btn:disabled, .risk-item button:disabled { opacity: .5; cursor: not-allowed; }
.notice-card { margin: 14px 0; border: 1px solid color-mix(in oklab, var(--ef-primary) 22%, var(--ef-border)); border-radius: 18px; padding: 12px 14px; background: color-mix(in oklab, var(--ef-primary) 8%, var(--ef-card)); color: var(--ef-fg); }
.template-strip, .recent-strip { margin-top: 14px; padding: 16px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.section-head.compact { align-items: center; margin-bottom: 10px; }
.section-head h2 { margin: 0; font-size: 17px; }
.section-head p { margin: 4px 0 0; color: var(--ef-muted-fg); font-size: 13px; }
.template-row, .recent-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(180px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 2px; }
.template-card, .recent-card { min-height: 88px; border: 1px solid var(--ef-border); border-radius: 16px; background: var(--ef-card); color: var(--ef-fg); padding: 14px; text-align: left; display: grid; gap: 6px; }
.template-card.active { border-color: var(--ef-primary); background: color-mix(in oklab, var(--ef-primary) 8%, var(--ef-card)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ef-primary) 30%, transparent); }
.doc-icon, .doc-mini { display: grid; place-items: center; color: var(--ef-primary); background: color-mix(in oklab, var(--ef-primary) 10%, var(--ef-card)); border-radius: 10px; }
.doc-icon { width: 34px; height: 34px; }
.doc-mini { width: 26px; height: 26px; }
.template-card small, .recent-card small { color: var(--ef-muted-fg); }
.recent-card { grid-template-columns: auto minmax(0, 1fr); align-items: center; min-height: 62px; }
.recent-card strong, .recent-card small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 32%); gap: 14px; margin-top: 14px; align-items: start; }
.editor-card, .risk-card { min-width: 0; padding: 16px; }
.workspace-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.workspace-head h2 { margin: 0; font-size: 22px; }
.workspace-head p { margin: 5px 0 0; color: var(--ef-muted-fg); font-size: 13px; line-height: 1.6; }
.mode-toggle { display: inline-flex; border: 1px solid var(--ef-border); border-radius: 999px; background: var(--ef-muted); padding: 3px; }
.mode-toggle button { border: 0; border-radius: 999px; padding: 8px 12px; color: var(--ef-muted-fg); background: transparent; font-weight: 800; }
.mode-toggle button.active { background: var(--ef-card); color: var(--ef-primary); box-shadow: 0 8px 20px rgba(15,23,42,.08); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.top-fields { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.field-wrap, .top-fields > label { display: grid; gap: 7px; color: var(--ef-fg); font-size: 13px; font-weight: 800; }
.field-wrap input, .field-wrap select, .field-wrap textarea, .top-fields input, .top-fields select, .top-fields textarea, .clause-editor input, .clause-editor textarea, .ai-suggestion select { width: 100%; border: 1px solid var(--ef-border); border-radius: 12px; background: var(--ef-card); color: var(--ef-fg); padding: 11px 12px; outline: none; }
.model-status-field { display: grid; gap: 6px; color: var(--ef-fg); font-size: 13px; font-weight: 800; }
.model-status-field > div { width: 100%; border: 1px solid var(--ef-border); border-radius: 12px; background: color-mix(in oklab, var(--ef-muted) 60%, var(--ef-card)); color: var(--ef-fg); padding: 10px 12px; }
.model-status-field > div.missing { background: color-mix(in oklab, var(--risk-high) 8%, var(--ef-card)); color: var(--risk-high); }
.template-form { margin-top: 14px; }
.template-form > p { margin: 0 0 12px; color: var(--ef-muted-fg); }
.template-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.template-form-grid label { display: grid; gap: 6px; color: var(--ef-fg); font-size: 13px; font-weight: 800; }
.template-form-grid label.wide { grid-column: 1 / -1; }
.template-form-grid input, .template-form-grid select, .template-form-grid textarea { width: 100%; border: 1px solid var(--ef-border); border-radius: 12px; background: var(--ef-card); color: var(--ef-fg); padding: 10px 12px; outline: none; }
.template-form-grid textarea { min-height: 78px; resize: vertical; }
.template-form-grid em { color: var(--risk-high); font-size: 12px; font-style: normal; }
.field-wrap textarea { min-height: 92px; resize: vertical; line-height: 1.7; }
.field-wrap small { color: var(--ef-muted-fg); font-weight: 500; }
.full-field { margin-top: 12px; }
.legal-tip { margin: 12px 0; border-radius: 16px; padding: 12px; background: color-mix(in oklab, var(--legal-gold) 13%, var(--ef-card)); color: color-mix(in oklab, var(--legal-gold) 40%, var(--ef-fg)); font-size: 13px; line-height: 1.6; }
.clause-workbench { display: grid; grid-template-columns: 210px minmax(0, 1fr) 270px; gap: 12px; margin-top: 16px; }
.clause-nav, .clause-editor, .ai-suggestion { border: 1px solid var(--ef-border); border-radius: 18px; background: var(--ef-card); padding: 12px; }
.mini-title { margin-bottom: 10px; color: var(--ef-muted-fg); font-size: 12px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
.clause-nav { display: grid; align-content: start; gap: 6px; }
.clause-nav button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--ef-fg); padding: 9px; text-align: left; }
.clause-nav button.active { border-color: color-mix(in oklab, var(--ef-primary) 35%, var(--ef-border)); background: color-mix(in oklab, var(--ef-primary) 9%, var(--ef-card)); color: var(--ef-primary); }
.clause-nav em { color: var(--risk-low); font-style: normal; font-weight: 900; }
.clause-editor { min-height: 420px; }
.editor-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.clause-editor input { margin-bottom: 10px; font-weight: 900; }
.clause-editor textarea { min-height: 310px; resize: vertical; line-height: 1.85; }
.empty-state, .empty-mini { display: grid; place-items: center; border: 1px dashed var(--ef-border); border-radius: 16px; min-height: 160px; padding: 18px; color: var(--ef-muted-fg); text-align: center; }
.empty-mini { min-height: 80px; font-size: 13px; }
.ai-suggestion h3, .side-section h3 { margin: 0 0 10px; font-size: 15px; }
.ai-suggestion p { color: var(--ef-muted-fg); font-size: 13px; line-height: 1.6; }
.suggestion-card { display: grid; gap: 10px; border: 1px solid color-mix(in oklab, var(--ef-primary) 25%, var(--ef-border)); border-radius: 16px; padding: 12px; background: color-mix(in oklab, var(--ef-primary) 7%, var(--ef-card)); }
.suggestion-card p { margin: 0; color: var(--ef-fg); white-space: pre-wrap; }
.risk-list { display: grid; gap: 10px; margin-top: 12px; }
.risk-item { border: 1px solid var(--ef-border); border-left-width: 4px; border-radius: 16px; padding: 12px; background: var(--ef-card); }
.risk-item.high { border-left-color: var(--risk-high); }
.risk-item.medium { border-left-color: var(--risk-medium); }
.risk-item.low { border-left-color: var(--risk-low); }
.risk-item > div:first-child { display: flex; justify-content: space-between; gap: 10px; }
.risk-item span { border-radius: 999px; padding: 3px 8px; background: var(--ef-muted); color: var(--ef-muted-fg); font-size: 12px; font-weight: 900; }
.risk-item p, .risk-item small { display: block; margin: 8px 0 0; color: var(--ef-muted-fg); line-height: 1.55; }
.risk-item em { display: inline-block; margin-top: 8px; color: var(--ef-primary); font-style: normal; font-weight: 900; }
.risk-item button { margin: 10px 8px 0 0; border: 1px solid var(--ef-border); border-radius: 999px; background: var(--ef-card); color: var(--ef-fg); padding: 6px 10px; font-size: 12px; font-weight: 850; }
.side-section { margin-top: 18px; }
.side-section details, .version-card { width: 100%; border: 1px solid var(--ef-border); border-radius: 14px; background: var(--ef-card); color: var(--ef-fg); padding: 10px; text-align: left; }
.side-section details + details, .version-card + .version-card { margin-top: 8px; }
.side-section summary { cursor: pointer; font-weight: 850; }
.side-section p, .version-card span, .version-card small { display: block; margin-top: 4px; color: var(--ef-muted-fg); font-size: 12px; line-height: 1.55; }
.score-card-inner { padding: 16px; border-radius: 18px; background: linear-gradient(135deg, color-mix(in oklab, var(--ef-primary) 12%, var(--ef-card)), var(--ef-card)); border: 1px solid color-mix(in oklab, var(--ef-primary) 24%, var(--ef-border)); }
.score-card-inner > div { font-size: 42px; font-weight: 900; color: var(--ef-primary); }
.score-card-inner p { margin: 4px 0 12px; color: var(--ef-muted-fg); }
.score-card-inner small { display: block; margin-top: 6px; color: var(--ef-muted-fg); font-size: 13px; line-height: 1.6; }
.contract-actionbar { position: sticky; bottom: 16px; z-index: 30; width: min(960px, calc(100% - 32px)); margin: 24px auto 0; border: 1px solid var(--ef-border); border-radius: 20px; padding: 12px; background: color-mix(in oklab, var(--ef-card) 94%, transparent); box-shadow: 0 14px 42px rgba(15,23,42,.16); backdrop-filter: blur(16px); }
@media (max-width: 1280px) { .contract-topbar { grid-template-columns: 1fr; } .top-actions { justify-content: flex-start; } .workspace-grid { grid-template-columns: 1fr; } .top-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } .clause-workbench { grid-template-columns: 180px minmax(0, 1fr); } .ai-suggestion { grid-column: 1 / -1; } }
@media (max-width: 760px) { .contract-page { padding: 10px; } .contract-topbar, .workspace-head, .section-head { display: grid; grid-template-columns: 1fr; } .contract-titleline h1 { white-space: normal; } .template-row, .recent-row { grid-auto-columns: minmax(150px, 78%); } .top-fields, .form-grid, .template-form-grid, .clause-workbench { grid-template-columns: 1fr; } .clause-nav { grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); overflow-x: auto; } .clause-editor { min-height: auto; } .contract-actionbar { justify-content: stretch; display: grid; grid-template-columns: repeat(2, 1fr); } .contract-actionbar .primary-btn, .contract-actionbar .ghost-btn { width: 100%; } }
`;
