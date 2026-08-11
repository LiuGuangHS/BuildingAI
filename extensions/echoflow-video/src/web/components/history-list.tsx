import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Eye, Film, RotateCcw, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { writeReuseParams } from "../lib/reuse-params-storage";
import {
    formatDateTime,
    getBillingLabel,
    getBillingTrustMessage,
    getGenerationModeLabel,
    getStatusLabel,
} from "../lib/video-labels";
import type { VideoGeneration } from "../services/types/generation";

interface HistoryListProps {
    items: VideoGeneration[];
    loading?: boolean;
    showDelete?: boolean;
    /** Base path for detail links, e.g. "/console/history" */
    detailBasePath?: string;
    onDelete?: (id: string) => void;
    onReuse?: (generation: VideoGeneration) => void;
    variant?: "compact" | "full" | "strip";
    action?: ReactNode;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    processing: "secondary",
    succeeded: "default",
    failed: "destructive",
};

export function HistoryList({
    items,
    loading,
    showDelete = true,
    detailBasePath = "/console/history",
    onDelete,
    onReuse,
    variant = "full",
    action,
}: HistoryListProps) {
    const navigate = useNavigate();
    const detailPath = (id: string) => detailBasePath ? `${detailBasePath.replace(/\/$/, "")}/${id}` : id;
    const handleReuse = (item: VideoGeneration) => {
        if (onReuse) {
            onReuse(item);
            return;
        }
        writeReuseParams({
            prompt: item.prompt,
            originalPrompt: item.originalPrompt,
            promptOptimizationSource: item.promptOptimizationSource,
            promptOptimizationStyle: item.promptOptimizationStyle,
            modelConfigId: item.modelConfigId,
            media: item.media,
            resolution: item.parameters.resolution,
            duration: item.parameters.duration,
            ratio: item.parameters.ratio,
            watermark: item.parameters.watermark,
        });
        toast.success("已复制参数");
        navigate("/");
    };

    if (variant === "strip") {
        return (
            <Card>
                <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Film className="size-5 text-primary" />
                            最近生成
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">生成完成后会进入历史，可查看结果或复用参数。</p>
                    </div>
                    {action}
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-video w-full rounded-lg" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                            <Film className="size-5" />
                            <span>暂无生成记录</span>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {items.slice(0, 6).map((item) => (
                                <div
                                    key={item.id}
                                    className="flex min-w-0 flex-col gap-2 rounded-lg border p-2 transition-colors hover:bg-muted/50"
                                >
                                    <Button
                                        variant="ghost"
                                        type="button"
                                        className="h-auto min-w-0 flex-col items-stretch justify-start gap-2 p-0 text-left hover:bg-transparent"
                                        onClick={() => navigate(detailPath(item.id))}
                                    >
                                        <span className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted">
                                            {item.videoUrl ? (
                                                <video src={item.videoUrl} className="size-full object-cover" muted />
                                            ) : (
                                                <Film className="size-5 text-muted-foreground" />
                                            )}
                                            <Badge variant="secondary" className="absolute bottom-1 left-1 px-1.5 py-0 text-[11px]">
                                                {item.parameters.duration ? `${item.parameters.duration}s` : getStatusLabel(item.status)}
                                            </Badge>
                                        </span>
                                        <span className="line-clamp-2 min-h-9 text-sm font-medium leading-snug">{item.prompt}</span>
                                        <span className="truncate text-xs text-muted-foreground">{getGenerationModeLabel(item)} · {getBillingTrustMessage(item)}</span>
                                    </Button>
                                    <div className="grid grid-cols-2 gap-1">
                                        <Button type="button" variant="outline" size="sm" onClick={() => navigate(detailPath(item.id))}>
                                            <Eye className="size-3.5" />
                                            查看
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => handleReuse(item)}>
                                            <RotateCcw className="size-3.5" />
                                            复用
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    const isCompact = variant === "compact";

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Film className="size-5" />
                        最近作品
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (items.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Film className="size-5" />
                        最近作品
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground py-6 text-center text-sm">
                        暂无生成记录
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Film className="size-5" />
                    最近作品
                </CardTitle>
                {detailBasePath && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(detailBasePath)}>
                        <Eye className="size-3.5" />
                        查看全部
                    </Button>
                )}
            </CardHeader>
            <CardContent className={isCompact ? "space-y-0" : "space-y-2"}>
                {items.slice(0, 12).map((item) => (
                    <div
                        key={item.id}
                        className={isCompact
                            ? "flex cursor-pointer items-center gap-3 border-b p-3 transition-colors last:border-b-0 hover:bg-muted/50"
                            : "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"}
                        onClick={() => navigate(detailPath(item.id))}
                    >
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {item.videoUrl ? (
                                <video src={item.videoUrl} className="size-full object-cover" muted />
                            ) : (
                                <Film className="size-5 text-muted-foreground" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.prompt}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant={statusVariant[item.status] ?? "secondary"} className="text-xs">
                                    {getStatusLabel(item.status)}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                    {getGenerationModeLabel(item)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {item.status === "failed" ? getBillingTrustMessage(item) : getBillingLabel(item.billingStatus)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {formatDateTime(item.createdAt)}
                                </span>
                            </div>
                        </div>

                        <div className="flex shrink-0 gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title="复制参数"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleReuse(item);
                                }}
                            >
                                <RotateCcw className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(detailPath(item.id));
                                }}
                            >
                                <Eye className="size-3.5" />
                            </Button>
                            {showDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete?.(item.id);
                                    }}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
