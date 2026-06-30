import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Progress } from "@buildingai/ui/components/ui/progress";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import {
    AlertCircle,
    CheckCircle2,
    Copy,
    Download,
    Film,
    Loader2,
    RefreshCw,
    RotateCcw,
    Sparkles,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
    formatDateTime,
    getBillingLabel,
    getBillingTrustMessage,
    getGenerationModeLabel,
    getStatusLabel,
} from "../lib/video-labels";
import type { VideoGeneration, VideoGenerationStatus } from "../services/types/generation";

interface VideoResultProps {
    generation?: VideoGeneration;
    isLoading?: boolean;
    onReuse?: (generation: VideoGeneration) => void;
}

export function VideoResult({ generation, isLoading, onReuse }: VideoResultProps) {
    if (isLoading && !generation) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Film className="size-5 text-primary" />
                            生成进度
                        </CardTitle>
                        <CardDescription>正在提交任务。</CardDescription>
                    </div>
                    <Badge variant="secondary">提交中</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!generation) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Film className="size-5 text-primary" />
                            生成进度
                        </CardTitle>
                        <CardDescription>提交后会在这里查看排队、生成和结果状态。</CardDescription>
                    </div>
                    <Badge variant="outline">等待提交</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex aspect-video flex-col items-center justify-center rounded-lg bg-slate-950 p-6 text-center text-white">
                        <Sparkles className="size-9 text-blue-200" />
                        <p className="mt-3 text-sm font-medium">等待视频任务</p>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-300">
                            视频生成不是实时完成。提交任务后可保持页面打开，也可以稍后从历史中查看结果。
                        </p>
                    </div>
                    <EmptyFlow />
                    <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-muted-foreground">提交时按配置预估消耗</span>
                        <strong>失败后按账务事实处理退款</strong>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { status, videoUrl, errorMessage, model } = generation;
    const isProcessing = status === "pending" || status === "processing";
    const isSuccess = status === "succeeded";
    const isFailed = status === "failed";

    return (
        <Card className="overflow-hidden">
            <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Film className="size-5 text-primary" />
                        生成进度
                    </CardTitle>
                    <CardDescription>{getGenerationModeLabel(generation)} · {generation.modelName || model}</CardDescription>
                </div>
                <Badge variant={isFailed ? "destructive" : isSuccess ? "default" : "secondary"}>
                    {getStatusLabel(status)}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950 text-white">
                    {isProcessing && (
                        <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
                            <Loader2 className="size-9 animate-spin text-blue-200" />
                            <p className="text-sm font-medium">视频正在排队生成</p>
                            <p className="max-w-sm text-xs leading-5 text-slate-300">
                                生成时间较长时无需重复提交，系统会继续刷新任务状态；你可以保持页面打开，也可以稍后从历史中查看结果。
                            </p>
                            <Progress value={Math.max(8, Math.min(generation.progress ?? 12, 96))} className="max-w-xs" />
                        </div>
                    )}

                    {isSuccess && videoUrl ? (
                        <>
                            <video src={videoUrl} controls className="size-full object-cover">
                                您的浏览器不支持视频播放
                            </video>
                            <Badge className="absolute left-3 top-3 gap-1.5">
                                <CheckCircle2 className="size-3.5" />
                                结果就绪
                            </Badge>
                        </>
                    ) : null}

                    {isSuccess && !videoUrl ? (
                        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <AlertCircle className="size-9 text-slate-300" />
                            <p className="text-sm font-medium">缺少视频地址</p>
                            <p className="max-w-sm text-xs text-slate-300">任务已完成但暂未返回可播放视频，请稍后刷新。</p>
                        </div>
                    ) : null}

                    {isFailed && (
                        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <XCircle className="size-9 text-red-200" />
                            <p className="text-sm font-medium">生成失败</p>
                            <p className="max-w-sm text-xs text-slate-300">{errorMessage || "任务没有生成成功，可以复用参数后再试一次。"}</p>
                        </div>
                    )}
                </div>

                {(isSuccess && !videoUrl) || isFailed ? (
                    <Alert variant={isFailed ? "destructive" : undefined}>
                        {isFailed ? <XCircle className="size-4" /> : <AlertCircle className="size-4" />}
                        <AlertTitle>{isFailed ? "生成失败" : "缺少视频地址"}</AlertTitle>
                        <AlertDescription>
                            {isFailed
                                ? `${errorMessage || "任务没有生成成功，可以复用参数后再试一次。"} ${getBillingTrustMessage(generation)}`
                                : "任务已完成但暂未返回可播放视频，请稍后刷新。"}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {videoUrl ? (
                        <Button asChild variant="outline">
                            <a href={videoUrl} target="_blank" rel="noopener noreferrer" download>
                                <Download className="size-4" />
                                下载
                            </a>
                        </Button>
                    ) : (
                        <Button variant="outline" type="button" disabled>
                            <Download className="size-4" />
                            下载
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        type="button"
                        disabled={!videoUrl}
                        onClick={async () => {
                            if (!videoUrl) return;
                            try {
                                await navigator.clipboard.writeText(videoUrl);
                                toast.success("视频链接已复制");
                            } catch {
                                toast.error("复制失败，请手动复制链接");
                            }
                        }}
                    >
                        <Copy className="size-4" />
                        复制链接
                    </Button>
                    <Button variant="outline" type="button" onClick={() => onReuse?.(generation)}>
                        <RotateCcw className="size-4" />
                        复用参数
                    </Button>
                    <Button variant="ghost" type="button" disabled={!isProcessing}>
                        <RefreshCw className="size-4" />
                        自动轮询
                    </Button>
                </div>

                <StatusTimeline generation={generation} />

                <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">{getBillingLabel(generation.billingStatus)} · {generation.billingAmount} 算力</span>
                    <strong>{isFailed ? getBillingTrustMessage(generation) : isSuccess ? "结果就绪" : `自动轮询中 · ${generation.progress ?? 0}%`}</strong>
                    <span className="text-muted-foreground">{formatDateTime(generation.updatedAt)}</span>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyFlow() {
    return (
        <div className="rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-4">
                {["提交", "排队", "生成", "结果"].map((title, index) => (
                    <div key={title} className="space-y-1">
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">{index + 1}</span>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">等待任务</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusTimeline({ generation }: { generation: VideoGeneration }) {
    const events = generation.statusEvents?.length
        ? generation.statusEvents
        : createFallbackEvents(generation);

    return (
        <div className="rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-4">
                {events.slice(0, 4).map((event, index) => (
                    <div key={`${event.status}-${event.at}-${index}`} className="space-y-1">
                        <span className={event.status === "failed" ? "flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground" : "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"}>
                            {event.status === "failed" ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                        </span>
                        <p className="text-sm font-medium">{getStatusLabel(event.status)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}{event.message ? ` · ${event.message}` : ""}</p>
                    </div>
                ))}
                {(generation.status === "pending" || generation.status === "processing") && events.length < 4 ? (
                    <div className="space-y-1">
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <RefreshCw className="size-3.5" />
                        </span>
                        <p className="text-sm font-medium">状态更新</p>
                        <p className="text-xs text-muted-foreground">等待生成结果写回</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function createFallbackEvents(generation: VideoGeneration): Array<{ status: VideoGenerationStatus; at: string; message?: string }> {
    const events: Array<{ status: VideoGenerationStatus; at: string; message?: string }> = [
        { status: "pending", at: generation.createdAt, message: "任务已提交" },
    ];
    if (generation.startedAt || generation.status === "processing" || generation.status === "succeeded" || generation.status === "failed") {
        events.push({ status: "processing", at: generation.startedAt || generation.updatedAt, message: "生成处理中" });
    }
    if (generation.status === "succeeded") {
        events.push({ status: "succeeded", at: generation.completedAt || generation.updatedAt, message: "结果就绪" });
    }
    if (generation.status === "failed") {
        events.push({ status: "failed", at: generation.completedAt || generation.updatedAt, message: "任务结束" });
    }
    return events;
}
