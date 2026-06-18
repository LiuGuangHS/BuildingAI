import { useEffect, useMemo, useState } from "react";

import { useAdminContractTemplatesQuery, useCreateAdminContractTemplateMutation, useDeleteAdminContractTemplateMutation, useResetBuiltinContractTemplatesMutation, useUpdateAdminContractTemplateMutation } from "../../services/console";
import type { ContractTemplate, UpsertContractTemplateParams } from "../../services/types";

const emptyTemplate: UpsertContractTemplateParams = {
    name: "",
    industry: "通用法务",
    contractType: "custom",
    description: "",
    fields: [{ key: "partyA", label: "甲方", type: "text", required: true }, { key: "partyB", label: "乙方", type: "text", required: true }],
    defaultSections: ["合同主体", "合同内容", "费用与付款", "违约责任", "争议解决"],
    promptTemplate: "",
    isActive: true,
    sortOrder: 0,
};

export default function ContractTemplatesConsolePage() {
    const { data: templates = [] } = useAdminContractTemplatesQuery();
    const createMutation = useCreateAdminContractTemplateMutation();
    const updateMutation = useUpdateAdminContractTemplateMutation();
    const deleteMutation = useDeleteAdminContractTemplateMutation();
    const resetMutation = useResetBuiltinContractTemplatesMutation();
    const [editing, setEditing] = useState<ContractTemplate | null>(null);
    const [form, setForm] = useState<UpsertContractTemplateParams>(emptyTemplate);
    const [fieldsText, setFieldsText] = useState(JSON.stringify(emptyTemplate.fields, null, 2));
    const [sectionsText, setSectionsText] = useState(emptyTemplate.defaultSections.join("\n"));
    const [message, setMessage] = useState("");
    const activeCount = useMemo(() => templates.filter((template) => template.isActive).length, [templates]);

    useEffect(() => {
        if (!editing) return;
        const nextForm = toForm(editing);
        setForm(nextForm);
        setFieldsText(JSON.stringify(nextForm.fields, null, 2));
        setSectionsText(nextForm.defaultSections.join("\n"));
        setMessage("");
    }, [editing]);

    function startCreate() {
        setEditing(null);
        setForm(emptyTemplate);
        setFieldsText(JSON.stringify(emptyTemplate.fields, null, 2));
        setSectionsText(emptyTemplate.defaultSections.join("\n"));
        setMessage("");
    }

    async function handleSubmit() {
        let fields: UpsertContractTemplateParams["fields"];
        try {
            fields = JSON.parse(fieldsText);
            if (!Array.isArray(fields)) throw new Error("字段配置必须是 JSON 数组");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
            return;
        }
        const params: UpsertContractTemplateParams = { ...form, fields, defaultSections: sectionsText.split("\n").map((item) => item.trim()).filter(Boolean) };
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, params });
                setMessage("模板已保存");
            } else {
                const created = await createMutation.mutateAsync(params);
                setEditing(created);
                setMessage("模板已创建");
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    async function handleDelete(template: ContractTemplate) {
        if (!window.confirm(`确定删除模板“${template.name}”吗？历史任务会继续保留模板快照。`)) return;
        await deleteMutation.mutateAsync(template.id);
        if (editing?.id === template.id) startCreate();
    }

    async function handleResetBuiltin() {
        await resetMutation.mutateAsync();
        setMessage("内置模板已同步");
    }

    function formatFieldsJson() {
        try {
            setFieldsText(JSON.stringify(JSON.parse(fieldsText), null, 2));
            setMessage("字段 JSON 已格式化");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
        }
    }

    return (
        <main className="ec-console-page">
            <header className="ec-console-header">
                <div>
                    <p className="ec-console-kicker">AI 合同管理</p>
                    <h1>合同模板</h1>
                    <p>维护用户端可选模板、字段结构、默认条款和生成提示。</p>
                </div>
                <div className="ec-header-actions">
                    <button className="ec-button" onClick={handleResetBuiltin} disabled={resetMutation.isPending}>同步内置模板</button>
                    <button className="ec-button is-primary" onClick={startCreate}>新增模板</button>
                </div>
            </header>

            <section className="ec-template-layout">
                <aside className="ec-card ec-list-panel">
                    <div className="ec-section-title">
                        <div>
                            <h2>模板列表</h2>
                            <p>共 {templates.length} 个，启用 {activeCount} 个</p>
                        </div>
                    </div>
                    <div className="ec-template-list">
                        {templates.map((template) => (
                            <button key={template.id} className={`ec-list-item ${editing?.id === template.id ? "is-active" : ""}`} onClick={() => setEditing(template)} type="button">
                                <div>
                                    <strong>{template.name}</strong>
                                    <span>{template.industry} / {template.contractType}</span>
                                </div>
                                <p>{template.description}</p>
                                <div className="ec-tag-row">
                                    <span className={`ec-tag ${template.isActive ? "is-success" : ""}`}>{template.isActive ? "启用" : "停用"}</span>
                                    {template.isBuiltin && <span className="ec-tag">内置</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="ec-card">
                    <div className="ec-section-title">
                        <div>
                            <h2>{editing ? editing.name : "新增模板"}</h2>
                            <p>{editing ? "编辑当前模板配置" : "创建一个新的合同生成模板"}</p>
                        </div>
                        {message && <span className={`ec-message ${message.includes("失败") || message.includes("不正确") ? "is-danger" : "is-success"}`}>{message}</span>}
                    </div>

                    <div className="ec-form-grid">
                        <Field label="模板名称" value={form.name} onChange={(name) => setForm({ ...form, name })} />
                        <Field label="行业" value={form.industry} onChange={(industry) => setForm({ ...form, industry })} />
                        <Field label="合同类型" value={form.contractType} onChange={(contractType) => setForm({ ...form, contractType })} />
                        <Field label="排序" type="number" value={String(form.sortOrder ?? 0)} onChange={(value) => setForm({ ...form, sortOrder: Number(value) || 0 })} />
                    </div>

                    <label className="ec-field">
                        <span>描述</span>
                        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                    </label>

                    <section className="ec-subsection">
                        <div className="ec-subsection-head">
                            <div>
                                <h3>高级字段 JSON</h3>
                                <p>字段会渲染为用户端填写表单。结构错误时后端会拒绝保存。</p>
                            </div>
                            <button className="ec-button" onClick={formatFieldsJson}>格式化</button>
                        </div>
                        <textarea className="ec-code-editor" value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} />
                    </section>

                    <section className="ec-subsection">
                        <h3>默认条款</h3>
                        <textarea className="ec-large-text" value={sectionsText} onChange={(event) => setSectionsText(event.target.value)} />
                        <p>每行一条，生成合同时作为默认条款结构。</p>
                    </section>

                    <section className="ec-subsection">
                        <h3>AI 提示</h3>
                        <textarea className="ec-large-text" value={form.promptTemplate ?? ""} onChange={(event) => setForm({ ...form, promptTemplate: event.target.value })} />
                        <p>用于约束生成风格、输出边界和业务注意事项。</p>
                    </section>

                    <section className="ec-publish-row">
                        <div>
                            <h3>发布状态</h3>
                            <p>启用后用户端可以选择该模板。</p>
                        </div>
                        <label>
                            <input type="checkbox" checked={form.isActive ?? true} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                            启用模板
                        </label>
                    </section>

                    <div className="ec-actions">
                        {editing && <button className="ec-button is-danger" onClick={() => handleDelete(editing)} disabled={deleteMutation.isPending}>删除模板</button>}
                        <button className="ec-button is-primary" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "保存模板" : "创建模板"}</button>
                    </div>
                </section>
            </section>
        </main>
    );
}

function toForm(template: ContractTemplate): UpsertContractTemplateParams {
    return { name: template.name, industry: template.industry, contractType: template.contractType, description: template.description, fields: template.fields, defaultSections: template.defaultSections, promptTemplate: template.promptTemplate ?? "", isActive: template.isActive ?? true, sortOrder: template.sortOrder ?? 0 };
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
    return <label className="ec-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
