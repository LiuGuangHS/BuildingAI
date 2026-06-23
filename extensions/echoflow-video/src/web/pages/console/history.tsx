import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Ban, Film, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "../../components/confirm-dialog";
import { ConsolePage } from "../../components/console-page";
import { ErrorState } from "../../components/error-state";
import {
    useBatchCancelVideoMutation,
    useBatchMarkFailedMutation,
    useBatchRetryVideoMutation,
    useDeleteVideoMutation,
    useVideoListQuery,
} from "../../services";
import type { ConsoleVideoGeneration, VideoGenerationBillingStatus, VideoGenerationStatus } from "../../services/types/generation";

const statusLabel: Record<string, string> = {
    pending: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    processing: "secondary",
    succeeded: "default",
    failed: "destructive",
};

const modelLabel: Record<string, string> = {
    "doubao-seedance-2-0-260128": "Seedance 2.0",
    "doubao-seedance-1-5-pro-251215": "Seedance 1.5 Pro",
    "kling-text2video": "可灵文生视频",
    "kling-image2video": "可灵图生视频",
    "kling-multi-image2video": "可灵多图参考",
    "happyhorse-1.0-i2v": "图生视频",
    "happyhorse-1.0-r2v": "参考图生视频",
    "happyhorse-1.0-t2v": "文生视频",
    "happyhorse-1.0-video-edit": "视频编辑",
};

const billingLabel: Record<string, string> = {
    pending: "待扣费",
    deducted: "已扣费",
    refunded: "已退款",
    failed: "扣费失败",
};

export default function HistoryPage() {
    useDocumentHead({ title: "视频生成历史" });
    const navigate = useNavigate();

    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [modelFilter, setModelFilter] = useState<string>("all");
    const [billingFilter, setBillingFilter] = useState<string>("all");
    const [failureCategory, setFailureCategory] = useState<string>("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useVideoListQuery({
        page,
        pageSize: 12,
        keyword: keyword || undefined,
        status: statusFilter !== "all" ? (statusFilter as VideoGenerationStatus) : undefined,
        model: modelFilter !== "all" ? modelFilter : undefined,
        billingStatus: billingFilter !== "all" ? (billingFilter as VideoGenerationBillingStatus) : undefined,
        failureCategory: failureCategory || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "createdAt",
        sortOrder: "DESC",
    });

    const deleteMutation = useDeleteVideoMutation();
    const batchMarkFailedMutation = useBatchMarkFailedMutation({
        onSuccess: (result) => {
            toast.success(`已标记失败 ${result.updated}/${result.total} 条`);
            refetch();
        },
        onError: (error) => toast.error(error.message || "批量操作失败"),
    });
    const batchCancelMutation = useBatchCancelVideoMutation({
        onSuccess: (result) => {
            toast.success(`已取消 ${result.updated}/${result.total} 条`);
            refetch();
        },
        onError: (error) => toast.error(error.message || "批量取消失败"),
    });
    const batchRetryMutation = useBatchRetryVideoMutation({
        onSuccess: (result) => {
            toast.success(`已创建重试任务 ${result.created}/${result.total} 条`);
            refetch();
        },
        onError: (error) => toast.error(error.message || "批量重试失败"),
    });

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
            toast.success("删除成功");
            refetch();
        } catch {
            toast.error("删除失败");
        }
    };

    return (
        <ConsolePage>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Film className="size-5" />
                        生成历史
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={batchMarkFailedMutation.isPending || !data?.items?.length}
                        onClick={() => {
                            const ids = (data?.items ?? [])
                                .filter((item) => item.status === "pending" || item.status === "processing")
                                .map((item) => item.id);
                            if (ids.length === 0) {
                                toast.info("当前页没有处理中任务");
                                return;
                            }
                            batchMarkFailedMutation.mutate(ids);
                        }}
                    >
                        当前页处理中标记失败
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={batchCancelMutation.isPending || !data?.items?.length}
                        onClick={() => {
                            const ids = (data?.items ?? [])
                                .filter((item) => item.status === "pending" || item.status === "processing")
                                .map((item) => item.id);
                            if (ids.length === 0) {
                                toast.info("当前页没有可取消任务");
                                return;
                            }
                            batchCancelMutation.mutate(ids);
                        }}
                    >
                        <Ban className="size-4" />
                        当前页取消
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={batchRetryMutation.isPending || !data?.items?.length}
                        onClick={() => {
                            const ids = (data?.items ?? [])
                                .filter((item) => item.status === "failed")
                                .map((item) => item.id);
                            if (ids.length === 0) {
                                toast.info("当前页没有失败任务");
                                return;
                            }
                            batchRetryMutation.mutate(ids);
                        }}
                    >
                        <RotateCcw className="size-4" />
                        当前页重试失败
                    </Button>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid gap-3 mb-4 md:grid-cols-3 xl:grid-cols-7">
                        <Input
                            placeholder="搜索提示词..."
                            value={keyword}
                            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                        />
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-28">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="pending">排队中</SelectItem>
                                <SelectItem value="processing">生成中</SelectItem>
                                <SelectItem value="succeeded">已完成</SelectItem>
                                <SelectItem value="failed">失败</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={billingFilter} onValueChange={(v) => { setBillingFilter(v); setPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="账务" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部账务</SelectItem>
                                <SelectItem value="pending">待扣费</SelectItem>
                                <SelectItem value="deducted">已扣费</SelectItem>
                                <SelectItem value="refunded">已退款</SelectItem>
                                <SelectItem value="failed">扣费失败</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={modelFilter} onValueChange={(v) => { setModelFilter(v); setPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="模型" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部模型</SelectItem>
                                <SelectItem value="doubao-seedance-2-0-260128">Seedance 2.0</SelectItem>
                                <SelectItem value="doubao-seedance-1-5-pro-251215">Seedance 1.5 Pro</SelectItem>
                                <SelectItem value="kling-text2video">可灵文生视频</SelectItem>
                                <SelectItem value="kling-image2video">可灵图生视频</SelectItem>
                                <SelectItem value="kling-multi-image2video">可灵多图参考</SelectItem>
                                <SelectItem value="happyhorse-1.0-t2v">文生视频</SelectItem>
                                <SelectItem value="happyhorse-1.0-i2v">图生视频</SelectItem>
                                <SelectItem value="happyhorse-1.0-r2v">参考图生视频</SelectItem>
                                <SelectItem value="happyhorse-1.0-video-edit">视频编辑</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="失败分类"
                            value={failureCategory}
                            onChange={(e) => { setFailureCategory(e.target.value); setPage(1); }}
                        />
                        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : isError ? (
                        <ErrorState
                            title="加载失败"
                            message="无法获取历史记录"
                            onRetry={() => refetch()}
                        />
                    ) : !data?.items?.length ? (
                        <p className="text-muted-foreground text-center text-sm py-12">暂无生成记录</p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {data.items.map((item: ConsoleVideoGeneration) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/console/history/${item.id}`)}
                                    >
                                        <div className="size-14 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                            {item.videoUrl ? (
                                                <video src={item.videoUrl} className="size-full object-cover" muted />
                                            ) : (
                                                <Film className="size-5 text-muted-foreground" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.prompt}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={statusVariant[item.status] ?? "secondary"} className="text-xs">
                                                    {statusLabel[item.status] ?? item.status}
                                                </Badge>
                                                <span className="text-muted-foreground text-xs">
                                                    {modelLabel[item.model] ?? item.model}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {billingLabel[item.billingStatus] ?? item.billingStatus}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTarget(item.id);
                                            }}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {data.total > 12 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        上一页
                                    </Button>
                                    <span className="text-sm flex items-center px-2">
                                        第 {page} 页
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page * 12 >= data.total}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        下一页
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!deleteTarget}
                title="删除生成记录"
                description="确定要删除这条记录吗？此操作不可撤销。"
                confirmText="删除"
                destructive
                loading={deleteMutation.isPending}
                onConfirm={async () => {
                    if (deleteTarget) {
                        await handleDelete(deleteTarget);
                        setDeleteTarget(null);
                    }
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </ConsolePage>
    );
}
