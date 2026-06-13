import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Copy, Download, Film, Loader2, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { VideoGeneration } from "../services/types/generation";

interface VideoResultProps {
    generation?: VideoGeneration;
    isLoading?: boolean;
    onReuse?: (generation: VideoGeneration) => void;
}

export function VideoResult({ generation, isLoading, onReuse }: VideoResultProps) {
    if (isLoading && !generation) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Film className="size-5" />
                        生成结果
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                </CardContent>
            </Card>
        );
    }

    if (!generation) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Film className="size-5" />
                        生成结果
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center text-sm py-8">
                        提交一个任务来查看结果
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { status, videoUrl, errorMessage, model } = generation;
    const isProcessing = status === "pending" || status === "processing";
    const isSuccess = status === "succeeded";
    const isFailed = status === "failed";

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Film className="size-5" />
                    生成结果
                </CardTitle>
                <Badge variant="secondary">{model}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Processing state */}
                {isProcessing && (
                    <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2 className="size-10 animate-spin text-primary" />
                        <p className="text-sm font-medium">视频生成中...</p>
                        <p className="text-muted-foreground text-xs">
                            任务已提交，通常需要 1-5 分钟，请耐心等待
                        </p>
                        <div className="flex gap-2 mt-2">
                            <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground text-xs">自动轮询中（每 3 秒）</span>
                        </div>
                    </div>
                )}

                {/* Success state */}
                {isSuccess && (
                    <div className="space-y-3">
                        <Alert>
                            <CheckCircle2 className="size-4 text-green-500" />
                            <AlertTitle>视频生成完成</AlertTitle>
                            <AlertDescription>视频已就绪，可在线播放或下载</AlertDescription>
                        </Alert>

                        {videoUrl ? (
                            <>
                                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                    <video
                                        src={videoUrl}
                                        controls
                                        className="w-full h-full"
                                        poster=""
                                    >
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
                                <Button type="button" variant="outline" className="w-full" onClick={() => onReuse?.(generation)}>
                                    <RotateCcw className="size-4" />
                                    复制参数再生成
                                </Button>
                            </>
                        ) : (
                            <Alert variant="destructive">
                                <AlertCircle className="size-4" />
                                <AlertTitle>缺少视频地址</AlertTitle>
                                <AlertDescription>任务已完成但未返回视频地址，请联系管理员</AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                {/* Failed state */}
                {isFailed && (
                    <div className="space-y-3">
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>生成失败</AlertTitle>
                            <AlertDescription>
                                {errorMessage || "未知错误，请重试"}
                            </AlertDescription>
                        </Alert>
                        <Button type="button" variant="outline" className="w-full" onClick={() => onReuse?.(generation)}>
                            <RotateCcw className="size-4" />
                            沿用参数重试
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
