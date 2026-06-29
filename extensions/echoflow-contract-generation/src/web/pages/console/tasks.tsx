import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@buildingai/ui/components/ui/alert-dialog";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";

import { useAdminContractTaskDetailQuery, useAdminContractTasksQuery, useDeleteAdminContractTaskMutation } from "../../services/console";
import { contractStatusText, contractStatusVariant, isContractBusyStatus, type AdminContractGenerationTask, type ContractGenerationStatus } from "../../services/types";

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

    async function handleDelete(task: AdminContractGenerationTask) {
        try {
            await deleteMutation.mutateAsync(task.id);
            if (selectedTaskId === task.id) setSelectedTaskId("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除失败");
        }
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
                <Card className="ec-list-panel">
                    <CardHeader>
                        <CardTitle>任务列表</CardTitle>
                        <CardDescription>{isFetching ? "加载中..." : `共 ${taskPage?.total ?? 0} 条`} · 第 {taskPage?.page ?? page} / {taskPage?.totalPages || 1} 页</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-3">
                            <Input value={keyword} onChange={(event) => updateKeyword(event.target.value)} placeholder="搜索标题或提示词" />
                            <Select value={status} onValueChange={updateStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {allStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            {tasks.map((task) => (
                                <Button
                                    key={task.id}
                                    variant={selectedTaskId === task.id ? "secondary" : "outline"}
                                    className="h-auto w-full justify-start p-3 text-left"
                                    onClick={() => setSelectedTaskId(task.id)}
                                    type="button"
                                >
                                    <span className="grid w-full gap-2">
                                        <span className="flex items-center justify-between gap-2">
                                            <strong className="truncate">{task.title}</strong>
                                            <Badge variant={contractStatusVariant(task.status)}>{contractStatusText(task.status)}</Badge>
                                        </span>
                                        <span className="text-muted-foreground text-xs">{task.industry || "未分类"} / {task.contractType}</span>
                                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>{formatDate(task.createdAt)}</span>
                                            <span>批注 {task.riskFindings?.length ?? 0}</span>
                                        </span>
                                    </span>
                                </Button>
                            ))}
                            {tasks.length === 0 ? <div className="ec-empty">没有匹配的任务。</div> : null}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button>
                            <Badge variant="outline">{taskPage?.page ?? page} / {taskPage?.totalPages || 1}</Badge>
                            <Button variant="outline" disabled={page >= (taskPage?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>下一页</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="ec-task-detail">
                    <CardContent>
                    {!detail ? (
                        <div className="ec-empty is-large">选择左侧任务查看详情。</div>
                    ) : (
                        <>
                            <div className="ec-detail-head">
                                <div>
                                    <Badge variant={contractStatusVariant(detail.status)}>{contractStatusText(detail.status)}</Badge>
                                    <h2>{detail.title}</h2>
                                    <p>用户：<span className="ec-mono">{detail.userId}</span> / 创建：{formatDate(detail.createdAt)}</p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={deleteMutation.isPending || isContractBusyStatus(detail.status)}>删除任务</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>删除任务</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                确定删除任务“{detail.title}”吗？处理中任务会被后端拒绝删除。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                            <AlertDialogAction variant="destructive" onClick={() => handleDelete(detail)}>
                                                确认删除
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
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
                                <article className="ec-subsection">
                                    <h3>排障信息</h3>
                                    <dl className="ec-detail-list">
                                        <div><dt>模型 ID</dt><dd className="ec-mono">{detail.modelId || "-"}</dd></div>
                                        <div><dt>Provider ID</dt><dd className="ec-mono">{detail.providerId || "-"}</dd></div>
                                        <div><dt>导出 URL</dt><dd className="ec-mono">{detail.resultUrl || "-"}</dd></div>
                                    </dl>
                                    <pre>{JSON.stringify({ requestPayload: detail.requestPayload, providerMetadata: detail.providerMetadata }, null, 2)}</pre>
                                </article>
                            </div>

                            <article className="ec-subsection">
                                <h3>AI 法务批注</h3>
                                <div className="ec-risk-list">
                                    {detail.riskFindings.map((risk, index) => (
                                        <div key={`${risk.sectionTitle}-${index}`}>
                                            <span className={`ec-risk-level ${risk.level}`}>{riskLevelText(risk.level)}</span>
                                            <strong>{risk.sectionTitle}</strong>
                                            <p>{risk.issue}</p>
                                            <em>{risk.suggestion}</em>
                                        </div>
                                    ))}
                                    {detail.riskFindings.length === 0 && <p>暂无 AI 法务批注。</p>}
                                </div>
                            </article>
                        </>
                    )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-md border bg-muted/30 p-3">
            <strong className="text-2xl">{value}</strong>
            <span className="block text-sm text-muted-foreground">{label}</span>
        </div>
    );
}

function riskLevelText(level: string) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level] ?? level;
}

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}
