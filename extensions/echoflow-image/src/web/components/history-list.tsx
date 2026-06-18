import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { cn } from "@buildingai/ui/lib/utils";
import { CopyPlus, HistoryIcon, ImageIcon, RefreshCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ImageGeneration } from "../services/types/generation";
import { ImageGenerationBillingStatus, ImageGenerationStatus } from "../services/types/generation";
import { ConfirmDialog } from "./confirm-dialog";
import { resolveImageSrc } from "./image-utils";
import { HistorySkeleton } from "./skeleton-card";

interface HistoryListProps {
    items: ImageGeneration[];
    loading?: boolean;
    detailBasePath?: string;
    title?: string;
    description?: string;
    showUserId?: boolean;
    compact?: boolean;
    onDelete?: (id: string) => Promise<void> | void;
    onRetry?: (id: string) => Promise<void> | void;
    onReuse?: (generation: ImageGeneration) => void;
}

const statusVariantMap: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    [ImageGenerationStatus.SUCCEEDED]: "default",
    [ImageGenerationStatus.FAILED]: "destructive",
    [ImageGenerationStatus.PROCESSING]: "secondary",
    [ImageGenerationStatus.PENDING]: "outline",
};

const statusLabelMap: Record<string, string> = {
    [ImageGenerationStatus.SUCCEEDED]: "成功",
    [ImageGenerationStatus.FAILED]: "失败",
    [ImageGenerationStatus.PROCESSING]: "生成中",
    [ImageGenerationStatus.PENDING]: "等待中",
};

export function HistoryList({
    items,
    loading,
    detailBasePath = "/console/history",
    title = "生成历史",
    description = "查看、重试或删除你的历史作品",
    showUserId = false,
    compact = false,
    onDelete,
    onRetry,
    onReuse,
}: HistoryListProps) {
    const navigate = useNavigate();
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!deleteTarget || !onDelete) return;
        setDeleting(true);
        try {
            await onDelete(deleteTarget);
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const handleRetry = async (id: string) => {
        if (!onRetry) return;
        setRetryingId(id);
        try {
            await onRetry(id);
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <>
            <Card className={cn("rounded-md shadow-sm transition-shadow hover:shadow-md", compact && "gap-0 overflow-hidden py-0")}>
                <CardHeader className={compact ? "px-4 py-4" : "pb-3"}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <HistoryIcon className="size-5 text-muted-foreground" />
                                {title}
                            </CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                        {!loading && items.length > 0 && (
                            <Badge variant="secondary" className="shrink-0">{items.length} 条</Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className={compact ? "px-4 pb-4" : undefined}>
                    {loading ? (
                        <HistorySkeleton />
                    ) : items.length === 0 ? (
                        <div className={cn(
                            "flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 px-4 text-center",
                            compact ? "min-h-28" : "min-h-[180px]",
                        )}>
                            <div className="mb-3 rounded-full bg-muted/40 p-3">
                                <HistoryIcon className="size-6 text-muted-foreground/60" />
                            </div>
                            <p className="font-medium text-muted-foreground">暂无历史记录</p>
                            <p className="mt-1 text-sm text-muted-foreground/70">完成一次生成后会出现在这里</p>
                        </div>
                    ) : (
                        <div className={compact ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-2.5"}>
                            {items.map((item) => {
                                const src = resolveImageSrc(item.resultImages?.[0]);
                                const isRetrying = retryingId === item.id;
                                if (compact) {
                                    return (
                                        <div
                                            key={item.id}
                                            className="group cursor-pointer overflow-hidden rounded-md border bg-background transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                                            onClick={() => navigate(`${detailBasePath}/${item.id}`)}
                                        >
                                            <div className="relative aspect-square bg-muted">
                                                {src ? (
                                                    <img src={src} alt={item.prompt} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="flex size-full items-center justify-center">
                                                        <ImageIcon className="size-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                                {item.status === ImageGenerationStatus.PROCESSING && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                                                        <div className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                                    </div>
                                                )}
                                                <Badge
                                                    variant={statusVariantMap[item.status] || "secondary"}
                                                    className="absolute left-2 top-2 text-[10px]"
                                                >
                                                    {statusLabelMap[item.status] || item.status}
                                                </Badge>
                                            </div>
                                            <div className="p-2">
                                                <p className="line-clamp-1 text-xs font-medium">{item.prompt}</p>
                                                <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                                                    <TimeText value={item.createdAt} variant="relative" />
                                                    <div
                                                        className="flex shrink-0 items-center gap-0.5 opacity-100"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        {onRetry && (
                                                            <Button size="icon-sm" variant="ghost" disabled={isRetrying} loading={isRetrying} onClick={() => handleRetry(item.id)}>
                                                                <RefreshCcw className="size-3.5" />
                                                            </Button>
                                                        )}
                                                        {onReuse && (
                                                            <Button size="icon-sm" variant="ghost" onClick={() => onReuse(item)}>
                                                                <CopyPlus className="size-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div
                                        key={item.id}
                                        className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 transition-all duration-200 hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
                                        onClick={() => navigate(`${detailBasePath}/${item.id}`)}
                                    >
                                        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                                            {src ? (
                                                <img src={src} alt={item.prompt} className="size-full object-cover transition duration-500 group-hover:scale-110" />
                                            ) : (
                                                <ImageIcon className="size-6 text-muted-foreground" />
                                            )}
                                            {item.status === ImageGenerationStatus.PROCESSING && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                                                    <div className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                <Badge variant={statusVariantMap[item.status] || "secondary"} className="text-[10px]">
                                                    {statusLabelMap[item.status] || item.status}
                                                </Badge>
                                                {item.billingStatus === ImageGenerationBillingStatus.REFUNDED && (
                                                    <Badge variant="outline" className="text-[10px]">已退款</Badge>
                                                )}
                                                {item.billingStatus === ImageGenerationBillingStatus.FAILED && (
                                                    <Badge variant="destructive" className="text-[10px]">扣费失败</Badge>
                                                )}
                                                <span className="text-[11px] text-muted-foreground">
                                                    <TimeText value={item.createdAt} variant="relative" />
                                                </span>
                                            </div>
                                            <p className="line-clamp-1 text-sm font-medium">{item.prompt}</p>
                                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                {item.modelName || item.modelId} · {item.size} · {item.n} 张 · 扣费 {item.billingAmount}
                                            </p>
                                            {showUserId && (
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">用户 {item.userId}</p>
                                            )}
                                        </div>
                                        <div
                                            className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            {onRetry && (
                                                <Button size="icon-sm" variant="ghost" disabled={isRetrying} loading={isRetrying} onClick={() => handleRetry(item.id)}>
                                                    <RefreshCcw className="size-3.5" />
                                                </Button>
                                            )}
                                            {onReuse && (
                                                <Button size="icon-sm" variant="ghost" onClick={() => onReuse(item)}>
                                                    <CopyPlus className="size-3.5" />
                                                </Button>
                                            )}
                                            {onDelete && (
                                                <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item.id)}>
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!deleteTarget}
                title="删除生成记录"
                description="确定要删除这条生成记录吗？此操作不可撤销。"
                confirmText="删除"
                destructive
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
}
