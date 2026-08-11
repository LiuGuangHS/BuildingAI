import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@buildingai/ui/components/ui/card";
import { ConfirmDialog } from "@buildingai/ui/components/confirm-dialog";
import { cn } from "@buildingai/ui/lib/utils";
import {
    AssetRecordType,
    Tldraw,
    createShapesForAssets,
    exportAs,
    type Editor,
    type TLImageAsset,
    type VecLike,
} from "tldraw";
import "tldraw/tldraw.css";
import { Download, ImageIcon, ImagePlus, Maximize2, PenLine, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ImageGeneration } from "../../services/types/generation";
import { createCanvasAssetId } from "../../lib/canvas-asset-id";

interface InspirationBoardProps {
    generation?: ImageGeneration;
    compact?: boolean;
}

function getImageDimensions(src: string) {
    return new Promise<{ width: number; height: number }>((resolve) => {
        const image = new Image();
        if (!src.startsWith("data:")) {
            image.crossOrigin = "anonymous";
        }
        image.onload = () =>
            resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024 });
        image.onerror = () => resolve({ width: 1024, height: 1024 });
        image.src = src;
    });
}

function normalizeCanvasSize(width: number, height: number) {
    const ratio = Math.min(360 / width, 360 / height, 1);
    return {
        width: Math.max(120, Math.round(width * ratio)),
        height: Math.max(120, Math.round(height * ratio)),
    };
}

function getCanvasCenter(editor: Editor): VecLike {
    const viewportBounds = editor.getViewportPageBounds();
    return { x: viewportBounds.center.x, y: viewportBounds.center.y };
}

export function InspirationBoard({ generation, compact = false }: InspirationBoardProps) {
    const editorRef = useRef<Editor | null>(null);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);

    const exportBoard = async () => {
        const editor = editorRef.current;
        if (!editor) return;
        const shapeIds = Array.from(editor.getCurrentPageShapeIds());
        if (!shapeIds.length) {
            toast.info("白板为空，先添加图片或批注");
            return;
        }
        await exportAs(editor, shapeIds, "png", "echoflow-inspiration-board");
    };

    const requestClearBoard = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const shapeIds = Array.from(editor.getCurrentPageShapeIds());
        if (!shapeIds.length) {
            toast.info("白板为空");
            return;
        }
        setClearDialogOpen(true);
    };

    const clearBoard = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const shapeIds = Array.from(editor.getCurrentPageShapeIds());
        if (shapeIds.length) {
            editor.deleteShapes(shapeIds);
            toast.success("已清空白板");
        }
        setClearDialogOpen(false);
    };

    return (
        <>
            <div
                className={
                    compact
                        ? "min-h-[720px]"
                        : "grid min-h-[720px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"
                }
            >
            <Card className="overflow-hidden">
                <CardHeader className="border-b">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-xl">灵感白板</CardTitle>
                                <Badge variant="secondary">tldraw</Badge>
                            </div>
                            <CardDescription>
                                手绘构图、写说明、圈重点，作为生成参考。
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={exportBoard}
                            >
                                <Download className="size-4" />
                                导出
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                                onClick={requestClearBoard}
                            >
                                <Trash2 className="size-4" />
                                清空
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => editorRef.current?.zoomToFit({ immediate: true })}
                            >
                                <Maximize2 className="size-4" />
                                适配
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {assetRail}
                <CardContent className={cn("p-0", compact ? "h-[600px]" : "h-[640px]")}>
                    <Tldraw
                        persistenceKey="echoflow-image:inspiration-board:v1"
                        onMount={(editor) => {
                            editorRef.current = editor;
                        }}
                    />
                </CardContent>
            </Card>
        </div>
            <ConfirmDialog
                open={clearDialogOpen}
                title="清空白板"
                description="确定清空当前白板上的所有内容吗？此操作不会删除生成历史。"
                confirmText="清空"
                destructive
                onConfirm={clearBoard}
                onCancel={() => setClearDialogOpen(false)}
            />
        </>
    );
}
