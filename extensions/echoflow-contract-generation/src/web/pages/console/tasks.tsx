import { useMemo, useState } from "react";

import { useAdminContractTaskDetailQuery, useAdminContractTasksQuery, useDeleteAdminContractTaskMutation } from "../../services/console";
import type { ContractGenerationStatus, ContractGenerationTask } from "../../services/types";

const PAGE_SIZE = 20;
const allStatuses: Array<{ value: "all" | ContractGenerationStatus; label: string }> = [
    { value: "all", label: "全部状态" },
    { value: "pending", label: "等待中" },
    { value: "processing", label: "生成中" },
    { value: "draft", label: "草稿" },
    { value: "reviewing", label: "审查中" },
    { value: "exporting", label: "导出中" },
    { value: "success", label: "已导出" },
    { value: "failed", label: "失败" },
    { value: "export_failed", label: "导出失败" },
];

export default function ContractTasksConsolePage() {
    const deleteMutation = useDeleteAdminContractTaskMutation();
    const [selectedTaskId, setSelectedTaskId] = useState("");
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<"all" | ContractGenerationStatus>("all");
    const [page, setPage] = useState(1);
    const query = useMemo(() => ({ page, pageSize: PAGE_SIZE, keyword: keyword.trim() || undefined, status: status === "all" ? undefined : status }), [keyword, page, status]);
    const { data: taskPage, isFetching } = useAdminContractTasksQuery(query);
    const { data: detail } = useAdminContractTaskDetailQuery(selectedTaskId);
    const tasks = taskPage?.items ?? [];

    async function handleDelete(task: ContractGenerationTask) {
        if (!window.confirm(`确定删除任务“${task.title}”吗？处理中任务会被后端拒绝删除。`)) return;
        await deleteMutation.mutateAsync(task.id);
        if (selectedTaskId === task.id) setSelectedTaskId("");
    }

    function updateKeyword(value: string) {
        setKeyword(value);
        setPage(1);
    }

    function updateStatus(value: string) {
        setStatus(value as "all" | ContractGenerationStatus);
        setPage(1);
    }

    return (
        <main className="ec-console-page">
            <header className="ec-console-header">
                <div>
                    <p className="ec-console-kicker">AI 合同管理</p>
                    <h1>生成任务</h1>
                    <p>查看合同生成、上传审查、导出状态和失败原因。</p>
                </div>
            </header>

            <section className="ec-task-layout">
                <aside className="ec-card ec-list-panel">
                    <div className="ec-filter-bar">
                        <input value={keyword} onChange={(event) => updateKeyword(event.target.value)} placeholder="搜索标题或提示词" />
                        <select value={status} onChange={(event) => updateStatus(event.target.value)}>
                            {allStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </div>
                    <div className="ec-list-meta">
                        <span>{isFetching ? "加载中..." : `共 ${taskPage?.total ?? 0} 条`}</span>
                        <span>第 {taskPage?.page ?? page} / {taskPage?.totalPages || 1} 页</span>
                    </div>
                    <div className="ec-task-list">
                        {tasks.map((task) => (
                            <button key={task.id} className={`ec-list-item ${selectedTaskId === task.id ? "is-active" : ""}`} onClick={() => setSelectedTaskId(task.id)} type="button">
                                <div>
                                    <strong>{task.title}</strong>
                                    <span>{statusText(task.status)}</span>
                                </div>
                                <p>{task.industry || "未分类"} / {task.contractType}</p>
                                <div className="ec-task-meta">
                                    <span>{formatDate(task.createdAt)}</span>
                                    <span>风险 {task.riskFindings?.length ?? 0}</span>
                                </div>
                            </button>
                        ))}
                        {tasks.length === 0 && <div className="ec-empty">没有匹配的任务。</div>}
                    </div>
                    <div className="ec-pagination">
                        <button className="ec-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
                        <button className="ec-button" disabled={page >= (taskPage?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>下一页</button>
                    </div>
                </aside>

                <section className="ec-card ec-task-detail">
                    {!detail ? (
                        <div className="ec-empty is-large">选择左侧任务查看详情。</div>
                    ) : (
                        <>
                            <div className="ec-detail-head">
                                <div>
                                    <span className={`ec-status-pill ${statusClass(detail.status)}`}>{statusText(detail.status)}</span>
                                    <h2>{detail.title}</h2>
                                    <p>用户：<span className="ec-mono">{detail.userId}</span> / 创建：{formatDate(detail.createdAt)}</p>
                                </div>
                                <button className="ec-button is-danger" onClick={() => handleDelete(detail)} disabled={deleteMutation.isPending || isBusyStatus(detail.status)}>删除任务</button>
                            </div>

                            {detail.errorMessage && <div className="ec-banner is-danger">失败原因：{detail.errorMessage}</div>}

                            <div className="ec-metric-grid">
                                <Metric label="总分" value={detail.score?.overall ?? "--"} />
                                <Metric label="完整性" value={detail.score?.completeness ?? "--"} />
                                <Metric label="风险控制" value={detail.score?.riskControl ?? "--"} />
                                <Metric label="扣费" value={detail.costCredits ?? 0} />
                            </div>

                            <div className="ec-detail-grid">
                                <article className="ec-subsection">
                                    <h3>用户输入</h3>
                                    <pre>{JSON.stringify(detail.variables ?? {}, null, 2)}</pre>
                                </article>
                                <article className="ec-subsection">
                                    <h3>合同条款</h3>
                                    <div className="ec-clause-list">
                                        {detail.sections.slice(0, 8).map((section, index) => (
                                            <div key={section.id ?? index}>
                                                <strong>{index + 1}. {section.title}</strong>
                                                <p>{section.content}</p>
                                            </div>
                                        ))}
                                        {detail.sections.length === 0 && <p>暂无条款内容。</p>}
                                    </div>
                                </article>
                            </div>

                            <article className="ec-subsection">
                                <h3>风险提示</h3>
                                <div className="ec-risk-list">
                                    {detail.riskFindings.map((risk, index) => (
                                        <div key={`${risk.sectionTitle}-${index}`}>
                                            <span className={`ec-risk-level ${risk.level}`}>{riskLevelText(risk.level)}</span>
                                            <strong>{risk.sectionTitle}</strong>
                                            <p>{risk.issue}</p>
                                            <em>{risk.suggestion}</em>
                                        </div>
                                    ))}
                                    {detail.riskFindings.length === 0 && <p>暂无风险提示。</p>}
                                </div>
                            </article>
                        </>
                    )}
                </section>
            </section>
        </main>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return <div className="ec-metric-card"><strong>{value}</strong><span>{label}</span></div>;
}

function statusText(status: string) {
    return { pending: "等待中", processing: "生成中", draft: "草稿", reviewing: "审查中", exporting: "导出中", success: "已导出", failed: "失败", export_failed: "导出失败" }[status] ?? status;
}

function statusClass(status: string) {
    if (["failed", "export_failed"].includes(status)) return "is-danger";
    if (["pending", "processing", "reviewing", "exporting"].includes(status)) return "is-warning";
    return "is-success";
}

function riskLevelText(level: string) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level] ?? level;
}

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}

function isBusyStatus(status: string) {
    return ["pending", "processing", "reviewing", "exporting"].includes(status);
}
