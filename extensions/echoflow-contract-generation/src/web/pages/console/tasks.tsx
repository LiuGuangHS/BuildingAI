import { useState } from "react";

import { useAdminContractTaskDetailQuery, useAdminContractTasksQuery, useDeleteAdminContractTaskMutation } from "../../services/console";
import type { ContractGenerationTask } from "../../services/types";

export default function ContractTasksConsolePage() {
    const { data: taskPage } = useAdminContractTasksQuery({ page: 1, pageSize: 30 });
    const deleteMutation = useDeleteAdminContractTaskMutation();
    const [selectedTaskId, setSelectedTaskId] = useState("");
    const [keyword, setKeyword] = useState("");
    const { data: detail } = useAdminContractTaskDetailQuery(selectedTaskId);
    const tasks = (taskPage?.items ?? []).filter((task) => `${task.title} ${task.industry} ${task.status}`.toLowerCase().includes(keyword.toLowerCase()));

    async function handleDelete(task: ContractGenerationTask) {
        if (!window.confirm(`确定删除任务“${task.title}”吗？`)) return;
        await deleteMutation.mutateAsync(task.id);
        if (selectedTaskId === task.id) setSelectedTaskId("");
    }

    return (
        <main className="task-console-shell">
            <style>{taskConsoleStyles}</style>
            <section className="task-console-page">
                <header className="task-header"><div><span>AI Contract Admin Console</span><h1>任务审查</h1><p>查看合同生成、风险审查、导出状态和用户输入。</p></div></header>
                <section className="task-grid">
                    <aside className="task-list card"><div className="task-search"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索任务、行业或状态..." /></div><div className="task-count">{tasks.length} / {taskPage?.items.length ?? 0} tasks</div>{tasks.map((task) => <button key={task.id} className={`task-item ${selectedTaskId === task.id ? "active" : ""}`} onClick={() => setSelectedTaskId(task.id)} type="button"><div><strong>{task.title}</strong><span>{statusText(task.status)}</span></div><p>{task.industry || "未分类"} · {new Date(task.createdAt).toLocaleString()}</p><small>评分 {task.score?.overall ?? "--"} · 风险 {task.riskFindings?.length ?? 0}</small></button>)}</aside>
                    <section className="task-detail card">{!detail ? <div className="empty-detail">选择左侧任务查看详情。</div> : <><div className="detail-head"><div><span className="status-pill">{statusText(detail.status)}</span><h2>{detail.title}</h2><p>用户：{detail.userId} · {new Date(detail.createdAt).toLocaleString()}</p></div><button className="danger-btn" onClick={() => handleDelete(detail)}>删除任务</button></div>{detail.errorMessage && <div className="error-banner">失败原因：{detail.errorMessage}</div>}<div className="metric-grid"><Metric label="总分" value={detail.score?.overall ?? "--"} /><Metric label="完整性" value={detail.score?.completeness ?? "--"} /><Metric label="风险控制" value={detail.score?.riskControl ?? "--"} /><Metric label="风险数" value={detail.riskFindings?.length ?? 0} /></div><div className="detail-panels"><article><h3>用户输入 JSON</h3><pre>{JSON.stringify(detail.variables ?? {}, null, 2)}</pre></article><article><h3>合同条款</h3><div className="clause-list">{detail.sections.slice(0, 8).map((section, index) => <div key={section.id ?? index}><strong>{index + 1}. {section.title}</strong><p>{section.content}</p></div>)}</div></article></div><article className="risk-table"><h3>风险提示</h3><div className="risk-rows">{detail.riskFindings.map((risk, index) => <div key={`${risk.sectionTitle}-${index}`}><span className={risk.level}>{riskLevelText(risk.level)}</span><strong>{risk.sectionTitle}</strong><p>{risk.issue}</p><em>{risk.suggestion}</em></div>)}</div></article></>}</section>
                </section>
            </section>
        </main>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return <div className="metric-card"><strong>{value}</strong><span>{label}</span></div>;
}

const taskConsoleStyles = `
body { margin: 0; }
.task-console-shell { --bg: var(--background, #f6f8fc); --fg: var(--foreground, #0f172a); --card: var(--card, #fff); --muted: var(--muted-foreground, #64748b); --border: var(--border, #dbe3ef); --primary: var(--primary, #0f62fe); min-height: 100vh; background: var(--bg); color: var(--fg); font-family: Inter, system-ui, sans-serif; }
.dark .task-console-shell { --bg: #08111f; --card: #0f1b2d; --fg: #eef4ff; --border: rgba(148,163,184,.22); --muted: #9fb0c8; }
.task-console-page { width: min(1440px, 100%); margin: 0 auto; padding: 24px 18px; }
.task-header { margin-bottom: 18px; }
.task-header span { color: var(--primary); font-size: 13px; font-weight: 950; }
.task-header h1 { margin: 8px 0; font-size: clamp(28px, 4vw, 40px); letter-spacing: -.04em; }
.task-header p { margin: 0; color: var(--muted); }
.task-grid { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 16px; align-items: start; }
.card { border: 1px solid var(--border); border-radius: 24px; background: var(--card); box-shadow: 0 18px 45px rgba(15,23,42,.08); }
.task-list, .task-detail { padding: 16px; }
.task-search input { width: 100%; border: 1px solid var(--border); border-radius: 14px; background: var(--card); color: var(--fg); padding: 12px 14px; outline: none; }
.task-count { margin: 12px 0; color: var(--muted); font-size: 13px; font-weight: 850; }
.task-item { width: 100%; border: 1px solid var(--border); border-radius: 18px; background: var(--card); color: var(--fg); padding: 14px; text-align: left; display: grid; gap: 8px; }
.task-item + .task-item { margin-top: 10px; }
.task-item.active { border-color: var(--primary); background: color-mix(in oklab, var(--primary) 8%, var(--card)); }
.task-item div { display: flex; justify-content: space-between; gap: 12px; }
.task-item span, .status-pill { border-radius: 999px; background: color-mix(in oklab, var(--primary) 10%, var(--card)); color: var(--primary); padding: 4px 8px; font-size: 11px; font-weight: 900; }
.task-item p, .task-item small, .detail-head p { margin: 0; color: var(--muted); }
.detail-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.detail-head h2 { margin: 8px 0; font-size: 28px; }
.danger-btn { border: 1px solid #fecaca; border-radius: 14px; background: #fef2f2; color: #dc2626; padding: 10px 14px; font-weight: 900; }
.error-banner { margin-top: 14px; border-radius: 16px; padding: 12px; background: #fef2f2; color: #dc2626; font-weight: 850; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.metric-card { border: 1px solid var(--border); border-radius: 18px; padding: 14px; background: color-mix(in oklab, var(--bg) 64%, var(--card)); }
.metric-card strong { display: block; color: var(--primary); font-size: 30px; }
.metric-card span { color: var(--muted); }
.detail-panels { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 14px; }
.detail-panels article, .risk-table { border: 1px solid var(--border); border-radius: 18px; padding: 14px; }
.detail-panels h3, .risk-table h3 { margin: 0 0 12px; }
pre { max-height: 430px; overflow: auto; border-radius: 14px; background: #0f172a; color: #e2e8f0; padding: 14px; }
.clause-list { display: grid; gap: 10px; }
.clause-list div, .risk-rows div { border-top: 1px solid var(--border); padding-top: 10px; }
.clause-list p, .risk-rows p, .risk-rows em { display: block; color: var(--muted); line-height: 1.6; }
.risk-table { margin-top: 14px; }
.risk-rows { display: grid; gap: 10px; }
.risk-rows span { display: inline-flex; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 900; }
.risk-rows span.high { background: #fef2f2; color: #dc2626; } .risk-rows span.medium { background: #fff7ed; color: #d97706; } .risk-rows span.low { background: #f0fdf4; color: #16a34a; }
.empty-detail { min-height: 420px; display: grid; place-items: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 18px; }
@media (max-width: 1080px) { .task-grid, .detail-panels { grid-template-columns: 1fr; } .task-list { max-height: none; } }
@media (max-width: 640px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } .detail-head { display: grid; } .danger-btn { width: 100%; } }
`;

function statusText(status: string) {
    return { pending: "等待中", processing: "生成中", draft: "草稿", reviewing: "审查中", exporting: "导出中", success: "已导出", failed: "失败", export_failed: "导出失败" }[status] ?? status;
}

function riskLevelText(level: string) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level] ?? level;
}

const panelStyle: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 20, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)", alignSelf: "start" };
const headingStyle: React.CSSProperties = { margin: "0 0 14px", fontSize: 22, fontWeight: 900 };
const mutedStyle: React.CSSProperties = { color: "#64748b", fontSize: 13 };
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "white", display: "grid", gap: 4, cursor: "pointer" };
const dangerButtonStyle: React.CSSProperties = { border: 0, borderRadius: 999, padding: "10px 16px", background: "#dc2626", color: "white", fontWeight: 900, cursor: "pointer", alignSelf: "start" };
const preStyle: React.CSSProperties = { background: "#0f172a", color: "#e2e8f0", borderRadius: 14, padding: 14, overflow: "auto" };
