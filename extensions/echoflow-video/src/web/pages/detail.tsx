import { useDocumentHead } from "@buildingai/hooks";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Clock, Copy, Download, ExternalLink, Film, History, RefreshCw, RotateCcw, VideoOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
    formatDuration,
    formatFileSize,
    formatFullDateTime,
    getBillingLabel,
    getBillingTrustMessage,
    getGenerationModeLabel,
    getMediaTypeLabel,
    getPromptSourceLabel,
    getStatusLabel,
} from "../lib/video-labels";
import { writeReuseParams } from "../lib/reuse-params-storage";
import {
    useWebRefreshVideoStatusMutation,
    useWebVideoDetailQuery,
} from "../services/web";
import type { VideoGeneration } from "../services/types/generation";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    processing: "secondary",
    succeeded: "default",
    failed: "destructive",
};

export default function WebDetailPage() {
    useDocumentHead({ title: "视频详情 - 视频生成" });
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: generation, isLoading, isError } = useWebVideoDetailQuery(id ?? "", { enabled: !!id });
    const refreshMutation = useWebRefreshVideoStatusMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "web", "generation", result.id], result);
            toast.success("状态已刷新");
        },
        onError: (error) => toast.error(error.message || "刷新失败"),
    });

    if (isLoading) {
        return (
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
                <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
                    <ArrowLeft className="size-4" />
                    返回
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Film className="size-5 text-primary" />
                            正在读取视频任务
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Skeleton className="h-56 w-full rounded-lg" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isError || !generation) {
        return (
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
                <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
                    <ArrowLeft className="size-4" />
                    返回
                </Button>
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <VideoOff className="size-5 text-muted-foreground" />
                            没有找到视频任务
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertTitle>任务可能已删除或链接无效</AlertTitle>
                            <AlertDescription>
                                视频生成是异步任务，历史记录只展示当前账号可访问的任务。你可以回到工作台重新提交，或查看历史记录确认任务状态。
                            </AlertDescription>
                        </Alert>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button type="button" onClick={() => navigate("/")}>
                                <Film className="size-4" />
                                返回工作台
                            </Button>
                            <Button type="button" variant="outline" onClick={() => navigate("/history")}>
                                <History className="size-4" />
                                查看历史
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
                    <ArrowLeft className="size-4" />
                    返回
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
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,400px)]">
                <VideoPanel generation={generation} />
                <DetailPanel generation={generation} />
            </div>
        </div>
    );
}

function VideoPanel({ generation }: { generation: VideoGeneration }) {
    if (generation.status === "succeeded" && generation.videoUrl) {
        return (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Film className="size-5" />视频</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="rounded-lg overflow-hidden bg-black aspect-video">
                        <video src={generation.videoUrl} controls className="w-full h-full">您的浏览器不支持视频播放</video>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Button asChild variant="outline">
                            <a href={generation.videoUrl} target="_blank" rel="noopener noreferrer" download>
                                <Download className="size-4" />
                                下载视频
                            </a>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(generation.videoUrl!);
                                    toast.success("视频链接已复制");
                                } catch {
                                    toast.error("复制失败，请手动复制链接");
                                }
                            }}
                        >
                            <Copy className="size-4" />
                            复制链接
                        </Button>
                        <ReuseButton generation={generation} />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (generation.status === "succeeded" && !generation.videoUrl) {
        return (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Film className="size-5" />视频</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-slate-950 p-6 text-center text-white">
                        <AlertCircle className="size-12 text-slate-300" />
                        <p className="text-sm font-medium">任务完成但未返回视频地址</p>
                        <p className="max-w-md text-xs leading-5 text-slate-300">
                            当前任务已结束，但暂时没有可播放的视频文件。请稍后刷新状态或回到历史记录再次查看。
                        </p>
                    </div>
                    <Alert>
                        <AlertCircle className="size-4" />
                        <AlertTitle>暂未返回视频地址</AlertTitle>
                        <AlertDescription>
                            这通常表示上游结果还没有写回可播放文件，插件不会暴露供应商原始响应。你可以稍后刷新状态。
                        </AlertDescription>
                    </Alert>
                    <ReuseButton generation={generation} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Film className="size-5" />视频</CardTitle></CardHeader>
            <CardContent>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Film className={generation.status === "failed" ? "size-12 text-muted-foreground" : "size-12 text-muted-foreground animate-pulse"} />
                    <p className={generation.status === "failed" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
                        {generation.status === "failed" ? "生成失败" : "视频生成中..."}
                    </p>
                    {generation.errorMessage && <p className="text-muted-foreground max-w-md text-xs">{generation.errorMessage}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function DetailPanel({ generation }: { generation: VideoGeneration }) {
    const duration = formatDuration(generation.startedAt, generation.completedAt);
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader><CardTitle className="text-lg">详情</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div><span className="text-xs text-muted-foreground">状态</span><Badge variant={statusVariant[generation.status] ?? "secondary"} className="ml-2">{getStatusLabel(generation.status)}</Badge></div>
                    <div>
                        <span className="text-xs text-muted-foreground">扣费</span>
                        <p className="text-sm">{getBillingLabel(generation.billingStatus)} · {generation.billingAmount} 算力</p>
                        <p className="text-muted-foreground text-xs">{getBillingTrustMessage(generation)}</p>
                    </div>
                    <div><span className="text-xs text-muted-foreground">生成方式</span><p className="text-sm">{getGenerationModeLabel(generation)}</p></div>
                    <div><span className="text-xs text-muted-foreground">模型</span><p className="break-words text-sm">{generation.modelName || generation.model}</p></div>
                    <div><span className="text-xs text-muted-foreground">提示词</span><p className="break-words text-sm leading-relaxed">{generation.prompt}</p></div>
                    {generation.originalPrompt && generation.originalPrompt !== generation.prompt && (
                        <div><span className="text-xs text-muted-foreground">原始提示词</span><p className="break-words text-sm leading-relaxed">{generation.originalPrompt}</p></div>
                    )}
                    {generation.promptOptimizationSource && (
                        <div><span className="text-xs text-muted-foreground">提示词优化</span><p className="text-sm">{getPromptSourceLabel(generation.promptOptimizationSource)} · {generation.promptOptimizationStyle ?? "默认"}</p></div>
                    )}
                    <div><span className="text-xs text-muted-foreground">创建时间</span><p className="text-sm">{formatFullDateTime(generation.createdAt)}</p></div>
                    {generation.completedAt && <div><span className="text-xs text-muted-foreground">完成时间</span><p className="text-sm">{formatFullDateTime(generation.completedAt)}</p></div>}
                    {duration && <div><span className="text-xs text-muted-foreground">耗时</span><p className="text-sm">{duration}</p></div>}
                    <ReuseButton generation={generation} />
                </CardContent>
            </Card>
            {generation.statusEvents && generation.statusEvents.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-lg">状态时间线</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {generation.statusEvents.map((event, index) => (
                            <div key={`${event.at}-${index}`} className="flex gap-3 text-sm">
                                <Clock className="mt-0.5 size-4 text-muted-foreground" />
                                <div className="min-w-0">
                                    <p className="font-medium">{getStatusLabel(event.status)}</p>
                                    <p className="text-muted-foreground text-xs">{formatFullDateTime(event.at)}</p>
                                    {event.message && <p className="text-muted-foreground mt-1 break-words text-xs">{event.message}</p>}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            {generation.media && generation.media.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-lg">素材</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {generation.media.map((item, index) => (
                            <div key={`${item.url}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                                <div className="size-14 overflow-hidden rounded-md bg-muted flex shrink-0 items-center justify-center">
                                    {item.type === "video" ? (
                                        <video src={item.url} muted className="size-full object-cover" />
                                    ) : (
                                        <img src={item.url} alt="" className="size-full object-cover" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">{getMediaTypeLabel(item.type)}</Badge>
                                        {item.fileName && <span className="max-w-[180px] truncate">{item.fileName}</span>}
                                    </div>
                                    <p className="text-muted-foreground truncate text-xs">
                                        {[formatFileSize(item.size), item.mimeType].filter(Boolean).join(" · ") || "平台素材"}
                                    </p>
                                </div>
                                <Button asChild variant="ghost" size="sm" className="shrink-0">
                                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="size-3.5" />
                                        查看素材
                                    </a>
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader><CardTitle className="text-lg">参数</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {Object.entries({
                        分辨率: generation.parameters.resolution,
                        时长: generation.parameters.duration != null ? `${generation.parameters.duration}s` : undefined,
                        比例: generation.parameters.ratio,
                        水印: generation.parameters.watermark == null ? undefined : generation.parameters.watermark ? "是" : "否",
                    }).map(([label, value]) => value ? (
                        <div key={label} className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="min-w-0 break-words text-right">{value}</span>
                        </div>
                    ) : null)}
                </CardContent>
            </Card>
        </div>
    );
}

function ReuseButton({ generation }: { generation: VideoGeneration }) {
    const navigate = useNavigate();
    return (
        <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
                writeReuseParams({
                    prompt: generation.prompt,
                    originalPrompt: generation.originalPrompt,
                    promptOptimizationSource: generation.promptOptimizationSource,
                    promptOptimizationStyle: generation.promptOptimizationStyle,
                    model: generation.model,
                    media: generation.media,
                    resolution: generation.parameters.resolution,
                    duration: generation.parameters.duration,
                    ratio: generation.parameters.ratio,
                    watermark: generation.parameters.watermark,
                    audioSetting: generation.parameters.audio_setting,
                });
                toast.success("已复制参数");
                navigate("/");
            }}
        >
            <RotateCcw className="size-4" />
            复制参数再生成
        </Button>
    );
}
