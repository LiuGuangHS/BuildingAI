import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, ChevronDown, ChevronRight, Clock, Copy, Download, Film, KeyRound, RefreshCw, RotateCcw, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ConsolePage } from "../../components/console-page";
import {
    useCancelVideoMutation,
    useMarkVideoStatusMutation,
    useRefreshVideoStatusMutation,
    useRetryVideoMutation,
    useUpdateVideoRemarkMutation,
    useVideoDetailQuery,
} from "../../services";
import type { ConsoleVideoGeneration } from "../../services/types/generation";

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
    "happyhorse-1.0-i2v": "图生视频 (i2v)",
    "happyhorse-1.0-r2v": "参考图生视频 (r2v)",
    "happyhorse-1.0-t2v": "文生视频 (t2v)",
    "happyhorse-1.0-video-edit": "视频编辑 (video-edit)",
};

const billingLabel: Record<string, string> = {
    pending: "待扣费",
    deducted: "已扣费",
    refunded: "已退款",
    failed: "扣费失败",
};

function formatDuration(startedAt?: string, completedAt?: string): string | null {
    if (!startedAt || !completedAt) return null;
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    return `${minutes} 分 ${remainSec} 秒`;
}

function JsonPanel({ title, data }: { title: string; data?: Record<string, unknown> | null }) {
    const [open, setOpen] = useState(false);
    if (!data || Object.keys(data).length === 0) return null;

    const formatted = JSON.stringify(data, null, 2);
    const truncated = data._truncated || data.truncated;

    return (
        <div className="border rounded-lg">
            <Button
                type="button"
                variant="ghost"
                className="flex h-auto w-full items-center justify-between p-3 text-sm font-medium"
                onClick={() => setOpen(!open)}
            >
                <span className="flex items-center gap-2">
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    {title}
                    {truncated && <Badge variant="secondary" className="text-xs">已截断</Badge>}
                </span>
            </Button>
            {open && (
                <pre className="border-t p-3 text-xs overflow-auto max-h-96 bg-muted/30 whitespace-pre-wrap break-all">
                    {formatted}
                </pre>
            )}
        </div>
    );
}

export default function DetailPage() {
    useDocumentHead({ title: "视频详情" });
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: generation, isLoading, isError } = useVideoDetailQuery(id ?? "", { enabled: !!id });
    const [adminRemark, setAdminRemark] = useState("");
    useEffect(() => {
        if (generation) setAdminRemark(generation.adminRemark ?? "");
    }, [generation?.id, generation?.adminRemark]);
    const refreshMutation = useRefreshVideoStatusMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "generation", result.id], result);
            toast.success("状态已刷新");
        },
        onError: (error) => toast.error(error.message || "刷新失败"),
    });
    const remarkMutation = useUpdateVideoRemarkMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "generation", result.id], result);
            toast.success("备注已保存");
        },
        onError: (error) => toast.error(error.message || "保存失败"),
    });
    const markStatusMutation = useMarkVideoStatusMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "generation", result.id], result);
            toast.success("状态已更新");
        },
        onError: (error) => toast.error(error.message || "状态更新失败"),
    });
    const cancelMutation = useCancelVideoMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "generation", result.id], result);
            toast.success("任务已取消");
        },
        onError: (error) => toast.error(error.message || "取消失败"),
    });
    const retryMutation = useRetryVideoMutation({
        onSuccess: (result) => {
            toast.success("已创建重试任务");
            navigate(`/console/history/${result.id}`);
        },
        onError: (error) => toast.error(error.message || "重试失败"),
    });

    if (isLoading) {
        return (
            <ConsolePage>
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </ConsolePage>
        );
    }

    if (isError || !generation) {
        return (
            <ConsolePage>
                <Button variant="ghost" onClick={() => navigate("/console/history")}>
                    <ArrowLeft className="size-4" />
                    返回历史
                </Button>
                <p className="text-center text-muted-foreground mt-12">记录不存在或加载失败</p>
            </ConsolePage>
        );
    }

    const { status, videoUrl, prompt, model, parameters, media, errorMessage, createdAt, completedAt,
        startedAt, requestKey, taskId, rawRequest, rawResponse } = generation;
    const duration = formatDuration(startedAt, completedAt);

    return (
        <ConsolePage>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Button variant="ghost" className="w-fit" onClick={() => navigate("/console/history")}>
                    <ArrowLeft className="size-4" />
                    返回历史
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={refreshMutation.isPending || generation.status === "succeeded" || generation.status === "failed"}
                    onClick={() => refreshMutation.mutate(generation.id)}
                >
                    <RefreshCw className={refreshMutation.isPending ? "size-4 animate-spin" : "size-4"} />
                    刷新状态
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={markStatusMutation.isPending || generation.status === "failed"}
                    onClick={() => markStatusMutation.mutate({
                        id: generation.id,
                        status: "failed",
                        message: "管理员手动标记失败",
                        failureCategory: "admin_marked",
                    })}
                >
                    <XCircle className="size-4" />
                    标记失败
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelMutation.isPending || generation.status === "succeeded" || generation.status === "failed"}
                    onClick={() => cancelMutation.mutate(generation.id)}
                >
                    <Ban className="size-4" />
                    取消
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={retryMutation.isPending || generation.status !== "failed"}
                    onClick={() => retryMutation.mutate(generation.id)}
                >
                    <RotateCcw className="size-4" />
                    重试
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,400px)]">
                {/* Video player */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Film className="size-5" />视频
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {status === "succeeded" && videoUrl ? (
                            <div className="space-y-3">
                                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                                    <video src={videoUrl} controls className="w-full h-full">
                                        您的浏览器不支持视频播放
                                    </video>
                                </div>
                                <Button asChild variant="outline" className="w-full">
                                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" download>
                                        <Download className="size-4" />
                                        下载视频
                                    </a>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(videoUrl);
                                        toast.success("视频链接已复制");
                                    }}
                                >
                                    <Copy className="size-4" />
                                    复制链接
                                </Button>
                            </div>
                        ) : status === "failed" ? (
                            <div className="flex flex-col items-center gap-3 py-12">
                                <Film className="size-12 text-muted-foreground" />
                                <p className="text-sm font-medium text-destructive">生成失败</p>
                                <p className="text-muted-foreground text-xs text-center max-w-xs">
                                    {errorMessage || "未知错误"}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-12">
                                <Film className="size-12 text-muted-foreground animate-pulse" />
                                <p className="text-sm text-muted-foreground">视频生成中...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Details */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">详情</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <span className="text-xs text-muted-foreground">状态</span>
                                <Badge variant={statusVariant[status] ?? "secondary"} className="ml-2">
                                    {statusLabel[status] ?? status}
                                </Badge>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">模型</span>
                                <p className="text-sm">{modelLabel[model] ?? model}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">扣费</span>
                                <p className="text-sm">
                                    {billingLabel[generation.billingStatus] ?? generation.billingStatus} · {generation.billingAmount} 算力
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">提示词</span>
                                <p className="text-sm">{prompt}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">创建时间</span>
                                <p className="text-sm">{new Date(createdAt).toLocaleString("zh-CN")}</p>
                            </div>
                            {startedAt && (
                                <div>
                                    <span className="text-xs text-muted-foreground">开始时间</span>
                                    <p className="text-sm">{new Date(startedAt).toLocaleString("zh-CN")}</p>
                                </div>
                            )}
                            {completedAt && (
                                <div>
                                    <span className="text-xs text-muted-foreground">完成时间</span>
                                    <p className="text-sm">{new Date(completedAt).toLocaleString("zh-CN")}</p>
                                </div>
                            )}
                            {duration && (
                                <div>
                                    <span className="text-xs text-muted-foreground">
                                        <Clock className="inline size-3 mr-1" />
                                        耗时
                                    </span>
                                    <p className="text-sm font-medium">{duration}</p>
                                </div>
                            )}
                            {generation.failureCategory && (
                                <div>
                                    <span className="text-xs text-muted-foreground">失败分类</span>
                                    <p className="text-sm">{generation.failureCategory}</p>
                                </div>
                            )}
                            {generation.promptOptimizationSource && (
                                <div>
                                    <span className="text-xs text-muted-foreground">提示词优化</span>
                                    <p className="text-sm">{generation.promptOptimizationSource === "ai" ? "AI" : "本地规则"} · {generation.promptOptimizationStyle ?? "默认"}</p>
                                </div>
                            )}
                            {requestKey && (
                                <div>
                                    <span className="text-xs text-muted-foreground">
                                        <KeyRound className="inline size-3 mr-1" />
                                        请求 Key
                                    </span>
                                    <p className="text-sm font-mono flex items-center gap-1">
                                        <span className="truncate">{requestKey}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-5 shrink-0"
                                            onClick={async () => {
                                                await navigator.clipboard.writeText(requestKey);
                                                toast.success("已复制");
                                            }}
                                        >
                                            <Copy className="size-3" />
                                        </Button>
                                    </p>
                                </div>
                            )}
                            {taskId && (
                                <div>
                                    <span className="text-xs text-muted-foreground">Task ID</span>
                                    <p className="text-sm font-mono truncate">{taskId}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">管理员备注</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                rows={4}
                                value={adminRemark}
                                onChange={(event) => setAdminRemark(event.target.value)}
                                placeholder="记录处理说明、退款核对、异常原因..."
                            />
                            <Button
                                type="button"
                                disabled={remarkMutation.isPending}
                                onClick={() => remarkMutation.mutate({ id: generation.id, adminRemark })}
                            >
                                <Save className="size-4" />
                                保存备注
                            </Button>
                        </CardContent>
                    </Card>

                    {generation.statusEvents && generation.statusEvents.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">状态时间线</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {generation.statusEvents.map((event, index) => (
                                    <div key={`${event.at}-${index}`} className="flex gap-3 text-sm">
                                        <Clock className="mt-0.5 size-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{statusLabel[event.status] ?? event.status}</p>
                                            <p className="text-muted-foreground text-xs">{new Date(event.at).toLocaleString("zh-CN")} · {event.source ?? "system"}</p>
                                            {event.message && <p className="text-muted-foreground mt-1 text-xs">{event.message}</p>}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">参数</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {parameters.resolution && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">分辨率</span>
                                    <span>{parameters.resolution}</span>
                                </div>
                            )}
                            {parameters.duration != null && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">时长</span>
                                    <span>{parameters.duration}s</span>
                                </div>
                            )}
                            {parameters.ratio && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">比例</span>
                                    <span>{parameters.ratio}</span>
                                </div>
                            )}
                            {parameters.watermark != null && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">水印</span>
                                    <span>{parameters.watermark ? "是" : "否"}</span>
                                </div>
                            )}
                            {parameters.audio_setting && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">音频</span>
                                    <span>{parameters.audio_setting}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {media && media.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">媒体素材 ({media.length})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {media.map((m, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {m.type === "first_frame" ? "首帧" : m.type === "reference_image" ? "参考图" : "视频"}
                                        </Badge>
                                        {m.fileName && <span className="max-w-[180px] truncate">{m.fileName}</span>}
                                        {m.size != null && <span className="text-muted-foreground text-xs">{formatFileSize(m.size)}</span>}
                                        {m.mimeType && <span className="text-muted-foreground text-xs">{m.mimeType}</span>}
                                        {m.fileId && <span className="text-muted-foreground text-xs">fileId: {m.fileId}</span>}
                                        <a
                                            href={m.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary truncate hover:underline"
                                        >
                                            {m.url}
                                        </a>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {(rawRequest || rawResponse) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">调试数据</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <JsonPanel title="请求体 (rawRequest)" data={rawRequest} />
                                <JsonPanel title="响应体 (rawResponse)" data={rawResponse} />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </ConsolePage>
    );
}

function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
