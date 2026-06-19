import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { ArrowLeft, Clock, Copy, Download, Film, RefreshCw, RotateCcw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
    queryClient,
    useWebRefreshVideoStatusMutation,
    useWebVideoDetailQuery,
} from "../services";
import type { VideoGeneration } from "../services/types/generation";
import { writeReuseParams } from "../lib/reuse-params-storage";

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

export default function WebDetailPage() {
    useDocumentHead({ title: "视频详情 - AI视频工作台" });
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: generation, isLoading, isError } = useWebVideoDetailQuery(id ?? "", { enabled: !!id });
    const refreshMutation = useWebRefreshVideoStatusMutation({
        onSuccess: (result) => {
            queryClient.setQueryData(["echoflow-video", "web", "generation", result.id], result);
            toast.success("状态已刷新");
        },
        onError: (error) => toast.error(error.message || "刷新失败"),
    });

    if (isLoading) {
        return <div className="min-h-screen p-4 md:p-6"><Skeleton className="h-64 w-full rounded-xl" /></div>;
    }

    if (isError || !generation) {
        return (
            <div className="min-h-screen p-4 md:p-6">
                <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />返回</Button>
                <p className="text-center text-muted-foreground mt-12">记录不存在</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6">
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
                                await navigator.clipboard.writeText(generation.videoUrl!);
                                toast.success("视频链接已复制");
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
                    <div><span className="text-xs text-muted-foreground">状态</span><Badge variant={statusVariant[generation.status] ?? "secondary"} className="ml-2">{statusLabel[generation.status] ?? generation.status}</Badge></div>
                    <div><span className="text-xs text-muted-foreground">扣费</span><p className="text-sm">{billingLabel[generation.billingStatus] ?? generation.billingStatus} · {generation.billingAmount} 算力</p></div>
                    <div><span className="text-xs text-muted-foreground">模型</span><p className="text-sm">{modelLabel[generation.model] ?? generation.model}</p></div>
                    <div><span className="text-xs text-muted-foreground">提示词</span><p className="text-sm leading-relaxed">{generation.prompt}</p></div>
                    {generation.originalPrompt && generation.originalPrompt !== generation.prompt && (
                        <div><span className="text-xs text-muted-foreground">原始提示词</span><p className="text-sm leading-relaxed">{generation.originalPrompt}</p></div>
                    )}
                    {generation.promptOptimizationSource && (
                        <div><span className="text-xs text-muted-foreground">提示词优化</span><p className="text-sm">{generation.promptOptimizationSource === "ai" ? "AI 优化" : "本地规则"} · {generation.promptOptimizationStyle ?? "默认"}</p></div>
                    )}
                    {generation.failureCategory && <div><span className="text-xs text-muted-foreground">失败分类</span><p className="text-sm">{generation.failureCategory}</p></div>}
                    <div><span className="text-xs text-muted-foreground">创建时间</span><p className="text-sm">{new Date(generation.createdAt).toLocaleString("zh-CN")}</p></div>
                    {generation.completedAt && <div><span className="text-xs text-muted-foreground">完成时间</span><p className="text-sm">{new Date(generation.completedAt).toLocaleString("zh-CN")}</p></div>}
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
            {generation.media && generation.media.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-lg">素材</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {generation.media.map((item, index) => (
                            <div key={`${item.url}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="outline">{mediaTypeLabel(item.type)}</Badge>
                                {item.fileName && <span className="max-w-[180px] truncate">{item.fileName}</span>}
                                {item.size != null && <span className="text-muted-foreground text-xs">{formatFileSize(item.size)}</span>}
                                {item.mimeType && <span className="text-muted-foreground text-xs">{item.mimeType}</span>}
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary max-w-full truncate hover:underline">
                                    {item.url}
                                </a>
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
                            <span>{value}</span>
                        </div>
                    ) : null)}
                </CardContent>
            </Card>
        </div>
    );
}

function mediaTypeLabel(type: string) {
    if (type === "first_frame") return "首帧";
    if (type === "reference_image") return "参考图";
    if (type === "video") return "视频";
    return type;
}

function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
                    promptOptimizerModelId: generation.promptOptimizerModelId,
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

function formatDuration(startedAt?: string, completedAt?: string) {
    if (!startedAt || !completedAt) return null;
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
