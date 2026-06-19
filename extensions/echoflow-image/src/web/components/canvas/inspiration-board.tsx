import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@buildingai/ui/components/ui/card";
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

import type { GeneratedImageRecord, ImageGeneration } from "../../services/types/generation";
import { resolveImageSrc } from "../image-utils";
import { createCanvasAssetId } from "../../lib/canvas-asset-id";
import { ConfirmDialog } from "../confirm-dialog";

interface InspirationBoardProps {
    generation?: ImageGeneration;
    compact?: boolean;
}

interface BoardAsset {
    image: GeneratedImageRecord;
    index: number;
    src: string;
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
    const [addingIndex, setAddingIndex] = useState<number | "all" | null>(null);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);

    const assets = useMemo<BoardAsset[]>(
        () =>
            (generation?.resultImages ?? [])
                .map((image, index) => ({ image, index, src: resolveImageSrc(image) }))
                .filter((item): item is BoardAsset => Boolean(item.src)),
        [generation?.resultImages],
    );

    const buildAsset = async (asset: BoardAsset): Promise<TLImageAsset> => {
        const dimensions = await getImageDimensions(asset.src);
        const normalized = normalizeCanvasSize(dimensions.width, dimensions.height);
        return {
            id: AssetRecordType.createId(`echoflow-board-${createCanvasAssetId(generation?.id, asset.index)}`),
            typeName: "asset",
            type: "image",
            props: {
                src: asset.src,
                w: normalized.width,
                h: normalized.height,
                mimeType: asset.image.mimeType ?? "image/png",
                name: `echoflow-result-${asset.index + 1}.png`,
                isAnimated: false,
            },
            meta: {
                generationId: generation?.id,
                revisedPrompt: asset.image.revisedPrompt,
            },
        };
    };

    const addAssets = async (items: BoardAsset[], marker: number | "all") => {
        const editor = editorRef.current;
        if (!editor || items.length === 0) return;
        setAddingIndex(marker);
        try {
            const tldrawAssets = await Promise.all(items.map(buildAsset));
            await createShapesForAssets(editor, tldrawAssets, getCanvasCenter(editor));
            toast.success(items.length > 1 ? "已加入白板" : "已加入灵感白板");
        } catch {
            toast.error("加入白板失败");
        } finally {
            setAddingIndex(null);
        }
    };

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

    const assetRail = compact ? (
        <div className="bg-muted/20 border-b px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <ImageIcon className="text-primary size-4" />
                        生成素材
                        <Badge variant="outline">{assets.length} 张</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                        点击缩略图放入白板，继续标注、排版和组合。
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 lg:w-auto"
                    disabled={!assets.length || addingIndex === "all"}
                    onClick={() => addAssets(assets, "all")}
                >
                    <ImagePlus className="size-4" />
                    {addingIndex === "all" ? "加入中..." : "加入全部"}
                </Button>
            </div>

            {assets.length ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {assets.map((asset) => (
                        <Button
                            key={asset.index}
                            type="button"
                            variant="ghost"
                            className="bg-background hover:border-primary/50 group relative size-20 shrink-0 overflow-hidden rounded-lg border p-0 text-left shadow-sm transition hover:shadow-md disabled:opacity-60"
                            onClick={() => addAssets([asset], asset.index)}
                            disabled={addingIndex === asset.index}
                        >
                            <img
                                src={asset.src}
                                alt={`生成素材 ${asset.index + 1}`}
                                className="size-full object-cover transition group-hover:scale-[1.03]"
                            />
                            <span className="bg-background/90 absolute inset-x-1 bottom-1 rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
                                结果 {asset.index + 1}
                            </span>
                        </Button>
                    ))}
                </div>
            ) : (
                <div className="bg-background/70 text-muted-foreground mt-3 rounded-lg border border-dashed px-3 py-3 text-sm">
                    当前还没有生成素材，白板仍可用于草图、文本和参考整理。
                </div>
            )}
        </div>
    ) : null;

    return (
        <>
            <div
                className={
                    compact
                        ? "min-h-[720px]"
                        : "grid min-h-[720px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"
                }
            >
            <aside className={compact ? "hidden" : "space-y-4"}>
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                                <PenLine className="size-4" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">灵感白板</CardTitle>
                                <CardDescription>用 tldraw 做批注、拼贴和草图</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            className="w-full gap-2"
                            variant="outline"
                            disabled={!assets.length || addingIndex === "all"}
                            onClick={() => addAssets(assets, "all")}
                        >
                            <ImagePlus className="size-4" />
                            {addingIndex === "all"
                                ? "加入中..."
                                : `加入全部结果 (${assets.length})`}
                        </Button>
                        <div className="space-y-2">
                            {assets.length ? (
                                assets.map((asset) => (
                                    <Button
                                        key={asset.index}
                                        type="button"
                                        variant="ghost"
                                        className="bg-background hover:border-primary/40 hover:bg-primary/5 h-auto w-full justify-start gap-3 rounded-lg border p-2 text-left transition"
                                        onClick={() => addAssets([asset], asset.index)}
                                        disabled={addingIndex === asset.index}
                                    >
                                        <img
                                            src={asset.src}
                                            alt={`结果 ${asset.index + 1}`}
                                            className="size-14 rounded-md object-cover"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">
                                                结果图 {asset.index + 1}
                                            </span>
                                            <span className="text-muted-foreground line-clamp-2 text-xs">
                                                {asset.image.revisedPrompt || "加入白板继续批注"}
                                            </span>
                                        </span>
                                    </Button>
                                ))
                            ) : (
                                <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                    先在生成模式完成一次出图，再把结果加入白板做标注和排版。
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </aside>

            <Card className="overflow-hidden">
                <CardHeader className="border-b">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-xl">批注与拼贴</CardTitle>
                                <Badge variant="secondary">tldraw</Badge>
                            </div>
                            <CardDescription>
                                手绘、文本、箭头、形状和图片拼贴，适合做灵感板和交付前标注。
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
                        onMount={(editor) => (editorRef.current = editor)}
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
