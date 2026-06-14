import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAdminContractGenerationConfigQuery, useAdminLlmModelsQuery, useUpdateAdminContractGenerationConfigMutation } from "../../services/console";

export default function ContractGenerationConfigPage() {
    const { data: config } = useAdminContractGenerationConfigQuery();
    const { data: models = [], isLoading } = useAdminLlmModelsQuery();
    const updateMutation = useUpdateAdminContractGenerationConfigMutation();
    const [modelId, setModelId] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (config?.modelId) setModelId(config.modelId);
    }, [config?.modelId]);

    async function handleSave() {
        if (!modelId) {
            setMessage("请选择一个启用的 LLM 模型");
            return;
        }
        try {
            await updateMutation.mutateAsync({ modelId });
            setMessage("固定模型已保存");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    return (
        <main className="contract-console-shell">
            <style>{consoleConfigStyles}</style>
            <section className="console-page">
                <header className="console-header">
                    <div><span>AI Contract Admin Console</span><h1>固定生成模型</h1><p>统一配置合同生成、风险审查和条款优化使用的 LLM 模型，用户端不暴露模型选择。</p></div>
                    <div className={`config-status ${config?.configured ? "active" : "inactive"}`}><i />{config?.configured ? "已配置" : "未配置"}</div>
                </header>

                <section className="config-grid">
                    <article className="console-card model-card">
                        <div className="card-title"><h2>模型选择</h2><p>选择一个启用的模型作为 AI 合同插件固定模型。</p></div>
                        <label className="console-field"><span>生成模型 *</span><select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={isLoading}><option value="">{isLoading ? "模型加载中..." : "请选择固定模型"}</option>{models.map((model) => <option key={model.id} value={model.id}>{model.providerName} / {model.name}</option>)}</select></label>
                        {models.length === 0 && !isLoading && <div className="banner danger">暂无可用 LLM 模型，请先在主后台配置并启用模型。</div>}
                        {message && <div className={`banner ${message.includes("失败") ? "danger" : "success"}`}>{message}</div>}
                        <div className="form-actions"><button onClick={handleSave} disabled={!modelId || updateMutation.isPending}>{updateMutation.isPending ? "保存中..." : "保存配置"}</button></div>
                    </article>

                    <aside className="console-card status-card">
                        <div className="card-title"><h2>当前模型状态</h2><p>用户端会自动使用该模型执行所有合同智能能力。</p></div>
                        <div className="model-name">{config?.model ? `${config.model.providerName} / ${config.model.name}` : "未配置固定模型"}</div>
                        <dl><div><dt>配置状态</dt><dd>{config?.configured ? "已配置" : "未配置"}</dd></div><div><dt>模型 ID</dt><dd>{config?.modelId || "-"}</dd></div></dl>
                    </aside>
                </section>

                <section className="console-card management-card">
                    <div className="card-title"><h2>相关管理</h2><p>维护合同模板，查看合同任务和风险审查结果。</p></div>
                    <div className="management-actions"><Link to="templates">模板管理 →</Link><Link to="tasks">任务管理 →</Link></div>
                </section>
            </section>
        </main>
    );
}

const consoleConfigStyles = `
body { margin: 0; }
.contract-console-shell { --bg: var(--background, #f6f8fc); --fg: var(--foreground, #0f172a); --card: var(--card, #fff); --muted: var(--muted-foreground, #64748b); --border: var(--border, #dbe3ef); --primary: var(--primary, #0f62fe); min-height: 100vh; background: var(--bg); color: var(--fg); font-family: Inter, system-ui, sans-serif; }
.dark .contract-console-shell { --bg: #08111f; --card: #0f1b2d; --fg: #eef4ff; --border: rgba(148,163,184,.22); --muted: #9fb0c8; }
.console-page { width: min(1280px, 100%); margin: 0 auto; padding: 28px 18px; }
.console-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.console-header span { color: var(--primary); font-weight: 900; font-size: 13px; }
.console-header h1 { margin: 8px 0; font-size: clamp(28px, 4vw, 42px); letter-spacing: -.04em; }
.console-header p, .card-title p { margin: 0; color: var(--muted); line-height: 1.65; }
.config-status { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); padding: 10px 14px; font-weight: 850; white-space: nowrap; }
.config-status i { width: 9px; height: 9px; border-radius: 50%; background: #f59e0b; }
.config-status.active i { background: #10b981; }
.config-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; }
.console-card { border: 1px solid var(--border); border-radius: 24px; background: var(--card); padding: 22px; box-shadow: 0 18px 45px rgba(15,23,42,.08); }
.card-title h2 { margin: 0 0 6px; font-size: 20px; }
.console-field { display: grid; gap: 8px; margin-top: 24px; font-weight: 850; }
.console-field select { width: 100%; border: 1px solid var(--border); border-radius: 14px; background: var(--card); color: var(--fg); padding: 13px 14px; outline: none; }
.banner { margin-top: 16px; border-radius: 16px; padding: 12px 14px; font-weight: 800; }
.banner.success { background: #ecfdf5; color: #047857; }
.banner.danger { background: #fef2f2; color: #dc2626; }
.model-name { margin: 22px 0; border-radius: 18px; background: color-mix(in oklab, var(--primary) 10%, var(--card)); padding: 18px; color: var(--primary); font-size: 20px; font-weight: 950; }
.status-card dl { display: grid; gap: 12px; margin: 0; }
.status-card dl div { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
.status-card dt { color: var(--muted); }
.status-card dd { margin: 0; font-weight: 850; }
.management-card { margin-top: 16px; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
.form-actions button, .management-actions a { border: 1px solid var(--border); border-radius: 14px; background: var(--card); color: var(--fg); padding: 12px 16px; font-weight: 900; text-decoration: none; }
.form-actions button { border-color: var(--primary); background: var(--primary); color: white; }
.form-actions button:disabled { border-color: var(--border); background: color-mix(in oklab, var(--muted) 16%, var(--card)); color: var(--muted); cursor: not-allowed; }
.management-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
@media (max-width: 820px) { .console-header, .config-grid { grid-template-columns: 1fr; display: grid; } .management-actions button { width: 100%; margin-left: 0; } }
`;
