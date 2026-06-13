import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { CheckCircle2, Clock, Film, ServerCog, Settings, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "../../components/confirm-dialog";
import { ErrorState } from "../../components/error-state";
import { HistoryList } from "../../components/history-list";
import {
    useDeleteVideoMutation,
    useScanStaleVideoMutation,
    useVideoHealthQuery,
    useVideoListQuery,
} from "../../services";

export default function AIVideoConsolePage() {
    useDocumentHead({ title: "AI视频工作台管理" });
    const navigate = useNavigate();
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const {
        data: historyData,
        isLoading: historyLoading,
        isError: historyError,
        refetch: refetchHistory,
    } = useVideoListQuery({ page: 1, pageSize: 20 });
    const { data: healthData } = useVideoHealthQuery();

    const deleteMutation = useDeleteVideoMutation();
    const scanStaleMutation = useScanStaleVideoMutation({
        onSuccess: (result) => {
            toast.success(`已扫描 ${result.total} 个超时任务`);
            refetchHistory();
        },
        onError: (error) => toast.error(error.message || "扫描失败"),
    });
    const stats = buildStats(historyData?.items || []);
    const healthLabel = buildHealthLabel(healthData?.happyhorse);

    const handleDeleteRequest = (id: string) => {
        setDeleteTarget(id);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget);
            toast.success("删除成功");
            setDeleteTarget(null);
            refetchHistory();
        } catch {
            toast.error("删除失败");
        }
    };

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-3 shadow-sm">管理后台</Badge>
                    <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                        <Film className="size-6 text-primary" />
                        AI视频工作台管理
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
                        查看生成状态、处理失败记录，并维护 HappyHorse 服务配置。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate("/console/config")}>
                        <Settings className="size-4" />
                        服务配置
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate("/console/history")}>
                        完整历史
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={scanStaleMutation.isPending}
                        onClick={() => scanStaleMutation.mutate()}
                    >
                        扫描超时
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <StatCard icon={<Film className="size-4" />} label="最近任务" value={stats.total} />
                <StatCard icon={<Clock className="size-4" />} label="处理中" value={stats.processing} />
                <StatCard icon={<CheckCircle2 className="size-4" />} label="已完成" value={stats.succeeded} />
                <StatCard icon={<XCircle className="size-4" />} label="失败" value={stats.failed} />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <StatCard icon={<ServerCog className="size-4" />} label="HappyHorse" value={healthLabel} />
                <StatCard icon={<Film className="size-4" />} label="启用模型" value={healthData?.enabledModelCount ?? "-"} />
                <StatCard icon={<Clock className="size-4" />} label="全局处理中" value={healthData?.activeTasks ?? "-"} />
                <StatCard
                    icon={<ShieldCheck className="size-4" />}
                    label="Webhook"
                    value={healthData?.provider.webhookSecretConfigured ? "已配置" : "未配置"}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <StatCard
                    icon={<Settings className="size-4" />}
                    label="模型完整度"
                    value={healthData?.modelCompleteness
                        ? `${healthData.modelCompleteness.configured}/${healthData.modelCompleteness.expected}`
                        : "-"}
                />
                <StatCard
                    icon={<XCircle className="size-4" />}
                    label="24h 失败"
                    value={healthData?.recentFailures?.total ?? "-"}
                />
                <StatCard
                    icon={<ServerCog className="size-4" />}
                    label="24h Provider 5xx"
                    value={healthData?.recentFailures?.provider5xx ?? "-"}
                />
                <StatCard
                    icon={<ShieldCheck className="size-4" />}
                    label="待核模型"
                    value={healthData?.modelCompleteness?.unverifiedModels.length ?? "-"}
                />
            </div>

            {(healthData?.modelCompleteness?.missingModels.length || healthData?.recentFailures?.total) ? (
                <Card>
                    <CardContent className="space-y-3 p-4">
                        {healthData?.modelCompleteness?.missingModels.length ? (
                            <div>
                                <p className="text-sm font-medium">缺失模型配置</p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {healthData.modelCompleteness.missingModels.join(", ")}
                                </p>
                            </div>
                        ) : null}
                        {healthData?.recentFailures?.total ? (
                            <div>
                                <p className="text-sm font-medium">最近失败分类</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {Object.entries(healthData.recentFailures.byCategory).map(([category, count]) => (
                                        <Badge key={category} variant="secondary">{category}: {count}</Badge>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            {historyError ? (
                <ErrorState title="加载历史失败" message="无法获取生成记录" onRetry={() => refetchHistory()} />
            ) : (
                <HistoryList
                    items={historyData?.items || []}
                    loading={historyLoading}
                    showDelete
                    detailBasePath="/console/history"
                    onDelete={handleDeleteRequest}
                />
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="删除生成记录"
                description="确定要删除这条记录吗？此操作不可撤销。"
                confirmText="删除"
                destructive
                loading={deleteMutation.isPending}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <div className="text-primary">{icon}</div>
                <div>
                    <p className="text-2xl font-semibold leading-none">{value}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function buildHealthLabel(status?: string) {
    if (status === "healthy") return "可用";
    if (status === "disabled") return "已停用";
    if (status === "unconfigured") return "未配置";
    if (status === "unavailable") return "不可用";
    return "-";
}

function buildStats(items: Array<{ status: string }>) {
    return {
        total: items.length,
        processing: items.filter((item) => item.status === "pending" || item.status === "processing").length,
        succeeded: items.filter((item) => item.status === "succeeded").length,
        failed: items.filter((item) => item.status === "failed").length,
    };
}
