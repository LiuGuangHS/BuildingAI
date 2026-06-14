import { useEffect, useState } from "react";

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

    useEffect(() => {
        if (!editing) return;
        const nextForm = toForm(editing);
        setForm(nextForm);
        setFieldsText(JSON.stringify(nextForm.fields, null, 2));
        setSectionsText(nextForm.defaultSections.join("\n"));
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
            if (!Array.isArray(fields)) throw new Error("字段配置必须是数组");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
            return;
        }
        const params: UpsertContractTemplateParams = { ...form, fields, defaultSections: sectionsText.split("\n").map((item) => item.trim()).filter(Boolean) };
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, params });
                setMessage("模板已更新");
            } else {
                await createMutation.mutateAsync(params);
                setMessage("模板已创建");
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    function formatFieldsJson() {
        try {
            setFieldsText(JSON.stringify(JSON.parse(fieldsText), null, 2));
            setMessage("字段 JSON 已格式化");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
        }
    }

    async function handleDelete(template: ContractTemplate) {
        if (!window.confirm(`确定删除模板“${template.name}”吗？`)) return;
        await deleteMutation.mutateAsync(template.id);
        if (editing?.id === template.id) startCreate();
    }

    return (
        <main className="template-console-shell">
            <style>{templateConsoleStyles}</style>
            <section className="template-console-page">
                <header className="template-header"><div><span>AI Contract Admin Console</span><h1>合同模板管理</h1><p>创建、编辑并发布合同模板，控制字段、默认条款和提示词行为。</p></div><div className="header-actions"><button onClick={startCreate}>新增模板</button><button onClick={() => resetMutation.mutate()}>同步内置模板</button></div></header>
                <section className="template-grid">
                    <aside className="template-list card">
                        <div className="list-head"><h2>模板列表</h2><small>共 {templates.length} 个模板</small></div>
                        {templates.map((template) => <button key={template.id} className={`template-item ${editing?.id === template.id ? "active" : ""}`} onClick={() => setEditing(template)} type="button"><div><strong>{template.name}</strong><span>{template.description}</span></div><div className="template-badges"><em>{template.isActive ? "Enabled" : "Disabled"}</em>{template.isBuiltin && <em>Built-in</em>}</div><small>{template.industry} · {template.contractType}</small></button>)}
                    </aside>
                    <section className="template-editor card">
                        <div className="editor-head"><div><h2>{editing ? editing.name : "新增模板"}</h2><p>{editing ? "编辑当前模板配置" : "创建一个新的合同生成模板"}</p></div>{message && <span className={`message ${message.includes("失败") || message.includes("不正确") ? "danger" : "success"}`}>{message}</span>}</div>
                        <div className="editor-section"><h3>Basic Info</h3><div className="field-grid"><Field label="模板名称" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Field label="行业" value={form.industry} onChange={(industry) => setForm({ ...form, industry })} /><Field label="合同类型" value={form.contractType} onChange={(contractType) => setForm({ ...form, contractType })} /><Field label="排序" value={String(form.sortOrder ?? 0)} onChange={(value) => setForm({ ...form, sortOrder: Number(value) || 0 })} /></div><label className="editor-field full"><span>描述</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>
                        <div className="editor-section"><div className="section-title"><h3>Fields Configuration</h3><button onClick={formatFieldsJson}>Format JSON</button></div><textarea className="code-editor" value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} /><div className="json-status">字段配置必须为 JSON 数组。</div></div>
                        <div className="editor-section"><h3>Default Clauses</h3><textarea className="large-text" value={sectionsText} onChange={(event) => setSectionsText(event.target.value)} /><small>每行一条，生成合同时作为默认条款结构。</small></div>
                        <div className="editor-section"><h3>Prompt Behavior</h3><textarea className="large-text" value={form.promptTemplate ?? ""} onChange={(event) => setForm({ ...form, promptTemplate: event.target.value })} /><small>可使用模板变量和字段变量约束 AI 输出。</small></div>
                        <div className="editor-section publish"><div><h3>Publishing State</h3><p>启用后用户端可使用该模板生成合同。</p></div><label><input type="checkbox" checked={form.isActive ?? true} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />启用模板</label></div>
                        <div className="sticky-actions">{editing && <button className="danger" onClick={() => handleDelete(editing)}>删除模板</button>}<button onClick={handleSubmit}>{editing ? "保存模板" : "创建模板"}</button></div>
                    </section>
                </section>
            </section>
        </main>
    );
}

function toForm(template: ContractTemplate): UpsertContractTemplateParams {
    return { name: template.name, industry: template.industry, contractType: template.contractType, description: template.description, fields: template.fields, defaultSections: template.defaultSections, promptTemplate: template.promptTemplate ?? "", isActive: template.isActive ?? true, sortOrder: template.sortOrder ?? 0 };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <label className="editor-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

const templateConsoleStyles = `
body { margin: 0; }
.template-console-shell { --bg: var(--background, #f6f8fc); --fg: var(--foreground, #0f172a); --card: var(--card, #fff); --muted: var(--muted-foreground, #64748b); --border: var(--border, #dbe3ef); --primary: var(--primary, #0f62fe); min-height: 100vh; background: var(--bg); color: var(--fg); font-family: Inter, system-ui, sans-serif; }
.dark .template-console-shell { --bg: #08111f; --card: #0f1b2d; --fg: #eef4ff; --border: rgba(148,163,184,.22); --muted: #9fb0c8; }
.template-console-page { width: min(1440px, 100%); margin: 0 auto; padding: 24px 18px 92px; }
.template-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.template-header span { color: var(--primary); font-size: 13px; font-weight: 950; }
.template-header h1 { margin: 8px 0; font-size: clamp(28px, 4vw, 40px); letter-spacing: -.04em; }
.template-header p { margin: 0; color: var(--muted); line-height: 1.6; }
.header-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.header-actions button, .sticky-actions button, .section-title button { border: 1px solid var(--border); border-radius: 13px; background: var(--card); color: var(--fg); padding: 11px 14px; font-weight: 900; }
.header-actions button:first-child, .sticky-actions button:last-child { border-color: var(--primary); background: var(--primary); color: white; }
.template-grid { display: grid; grid-template-columns: 370px minmax(0, 1fr); gap: 16px; align-items: start; }
.card { border: 1px solid var(--border); border-radius: 24px; background: var(--card); box-shadow: 0 18px 45px rgba(15,23,42,.08); }
.template-list { padding: 16px; display: grid; gap: 10px; }
.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.list-head h2, .editor-head h2 { margin: 0; font-size: 20px; }
.list-head small, .editor-head p, .editor-section small, .editor-section p { color: var(--muted); }
.template-item { border: 1px solid var(--border); border-radius: 16px; background: var(--card); color: var(--fg); padding: 14px; text-align: left; display: grid; gap: 10px; }
.template-item.active { border-color: var(--primary); background: color-mix(in oklab, var(--primary) 8%, var(--card)); }
.template-item span { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--muted); font-size: 12px; line-height: 1.5; }
.template-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.template-badges em { border-radius: 999px; background: color-mix(in oklab, var(--primary) 10%, var(--card)); color: var(--primary); padding: 4px 8px; font-size: 11px; font-style: normal; font-weight: 900; }
.template-editor { padding: 18px; }
.editor-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.message { border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; white-space: nowrap; }
.message.success { background: #ecfdf5; color: #047857; } .message.danger { background: #fef2f2; color: #dc2626; }
.editor-section { border: 1px solid var(--border); border-radius: 18px; padding: 16px; margin-top: 12px; }
.editor-section h3 { margin: 0 0 12px; font-size: 16px; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.editor-field { display: grid; gap: 7px; font-size: 13px; font-weight: 850; }
.editor-field.full { margin-top: 12px; }
.editor-field input, .editor-field textarea, .code-editor, .large-text { width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--card); color: var(--fg); padding: 11px 12px; outline: none; }
.editor-field textarea { min-height: 78px; line-height: 1.6; resize: vertical; }
.code-editor { min-height: 260px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.65; background: color-mix(in oklab, var(--bg) 70%, var(--card)); }
.json-status { margin-top: 10px; color: #047857; font-size: 12px; font-weight: 850; }
.large-text { min-height: 130px; resize: vertical; line-height: 1.65; }
.publish { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.publish label { display: inline-flex; align-items: center; gap: 8px; font-weight: 900; }
.sticky-actions { position: sticky; bottom: 0; display: flex; gap: 10px; justify-content: flex-end; margin: 16px -18px -18px; border-top: 1px solid var(--border); padding: 14px 18px; background: color-mix(in oklab, var(--card) 92%, transparent); backdrop-filter: blur(12px); }
.sticky-actions .danger { margin-right: auto; border-color: #fecaca; color: #dc2626; }
@media (max-width: 980px) { .template-grid { grid-template-columns: 1fr; } .template-header { display: grid; } .header-actions { justify-content: flex-start; } }
@media (max-width: 640px) { .field-grid { grid-template-columns: 1fr; } .publish, .editor-head { display: grid; } .sticky-actions { display: grid; grid-template-columns: 1fr 1fr; } .sticky-actions .danger { margin-right: 0; } }
`;

const panelStyle: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 20, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)", alignSelf: "start" };
const headingStyle: React.CSSProperties = { margin: "0 0 14px", fontSize: 22, fontWeight: 900 };
const labelStyle: React.CSSProperties = { display: "block", margin: "14px 0 6px", fontSize: 14, fontWeight: 800 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dbe2ea", borderRadius: 12, padding: "10px 12px", outline: "none" };
const mutedStyle: React.CSSProperties = { color: "#64748b", fontSize: 13 };
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "white", display: "grid", gap: 4, cursor: "pointer" };
const smallButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: "white", fontWeight: 800, cursor: "pointer" };
const primaryButtonStyle: React.CSSProperties = { border: 0, borderRadius: 999, padding: "11px 18px", background: "#4f46e5", color: "white", fontWeight: 900, cursor: "pointer" };
const dangerButtonStyle: React.CSSProperties = { border: 0, borderRadius: 999, padding: "11px 18px", background: "#dc2626", color: "white", fontWeight: 900, cursor: "pointer" };
