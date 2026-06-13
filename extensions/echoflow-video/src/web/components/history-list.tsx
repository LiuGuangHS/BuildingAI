import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Eye, Film, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { VideoGeneration } from "../services/types/generation";

interface HistoryListProps {
    items: VideoGeneration[];
    loading?: boolean;
    showDelete?: boolean;
    /** Base path for detail links, e.g. "/console/history" */
    detailBasePath?: string;
    onDelete?: (id: string) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    processing: "secondary",
    succeeded: "default",
    failed: "destructive",
};

const statusLabel: Record<string, string> = {
    pending: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
};

const billingLabel: Record<string, string> = {
    pending: "待扣费",
    deducted: "已扣费",
    refunded: "已退款",
    failed: "扣费失败",
};

const modelLabel: Record<string, string> = {
    "happyhorse-1.0-i2v": "图生视频",
    "happyhorse-1.0-r2v": "参考图生视频",
    "happyhorse-1.0-t2v": "文生视频",
    "happyhorse-1.0-video-edit": "视频编辑",
};

function formatTime(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function HistoryList({ items, loading, showDelete = true, detailBasePath = "/console/history", onDelete }: HistoryListProps) {
    const navigate = useNavigate();
    const detailPath = (id: string) => detailBasePath ? `${detailBasePath}/${id}` : id;

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
                    <p className="text-muted-foreground text-center text-sm py-6">
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
            <CardContent className="space-y-2">
                {items.slice(0, 6).map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(detailPath(item.id))}
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
                                    {formatTime(item.createdAt)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-1 shrink-0">
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
