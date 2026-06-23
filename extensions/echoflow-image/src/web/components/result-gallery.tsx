import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { cn } from "@buildingai/ui/lib/utils";
import { Copy, Download, ExternalLink, ImageIcon, Images, LayoutPanelTop, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { GeneratedImageRecord, ImageGeneration } from "../services/types/generation";
import { ImageGenerationStatus } from "../services/types/generation";
import { downloadImage, resolveImageSrc } from "./image-utils";
import { ResultSkeleton } from "./skeleton-card";

interface ResultGalleryProps {
    generation?: ImageGeneration;
    images?: GeneratedImageRecord[];
    isLoading?: boolean;
    onOpenCanvas?: () => void;
    variant?: "card" | "stage";
}

function getStatusLabel(status?: ImageGenerationStatus | string) {
    if (status === ImageGenerationStatus.SUCCEEDED) return "已完成";
    if (status === ImageGenerationStatus.FAILED) return "失败";
    if (status === ImageGenerationStatus.PROCESSING) return "生成中";
    if (status === ImageGenerationStatus.PENDING) return "排队中";
    return status;
}

export function ResultGallery({ generation, images, isLoading, onOpenCanvas, variant = "card" }: ResultGalleryProps) {
    const resolvedImages = images ?? generation?.resultImages ?? [];
    const isStage = variant === "stage";

    const copyText = async (text?: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            toast.success("已复制提示词");
        } catch {
            toast.error("复制失败，请手动选择文本");
        }
    };

    const handleDownloadAll = async () => {
        for (let i = 0; i < resolvedImages.length; i++) {
            const src = resolveImageSrc(resolvedImages[i]);
            if (src) {
                downloadImage(src, `echoflow-image-${generation?.id || "result"}-${i + 1}.png`);
            }
        }
    };

    return (
        <Card
            className={cn(
                "gap-0 overflow-hidden rounded-lg py-0 shadow-sm",
                isStage && "min-h-[28rem] md:min-h-[34rem]",
                !isStage && resolvedImages.length > 0 && "border-primary/10 bg-gradient-to-br from-background via-background to-primary/[0.03]",
            )}
        >
            <div className="border-b bg-card/70 px-4 py-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                                resolvedImages.length > 0 && "bg-primary/10 text-primary",
                            )}>
                                <ImageIcon className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <h2 className={cn("truncate font-semibold", isStage ? "text-base" : "text-lg")}>结果舞台</h2>
                                <p className="truncate text-xs text-muted-foreground">
                                    {resolvedImages.length > 0
                                        ? `${resolvedImages.length} 张结果，可下载或继续整理到画布`
                                        : "生成完成后，结果会停在这里供你挑选。"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {resolvedImages.length > 0 && onOpenCanvas && (
                            <Button variant="default" size="sm" className="hidden sm:flex" onClick={onOpenCanvas}>
                                <LayoutPanelTop className="size-3.5" />
                                整理到画布
                            </Button>
                        )}
                        {generation?.prompt && (
                            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => copyText(generation.prompt)}>
                                <Copy className="size-3.5" />
                                复制提示词
                            </Button>
                        )}
                        {resolvedImages.length > 1 && (
                            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={handleDownloadAll}>
                                <Images className="size-3.5" />
                                全部下载
                            </Button>
                        )}
                        {generation?.status && (
                            <Badge
                                variant={
                                    generation.status === ImageGenerationStatus.SUCCEEDED ? "default"
                                        : generation.status === ImageGenerationStatus.FAILED ? "destructive"
                                            : "secondary"
                                }
                                className="shrink-0"
                            >
                                {getStatusLabel(generation.status)}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <CardContent className={cn(isStage ? "p-3 md:p-4" : "p-4 md:p-5")}>
                {isLoading ? (
                    <ResultSkeleton />
                ) : generation?.status === ImageGenerationStatus.FAILED ? (
                    <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 p-4 text-center md:min-h-[28.5rem]">
                        <div className="mb-4 rounded-full bg-destructive/10 p-3">
                            <ImageIcon className="size-8 text-destructive" />
                        </div>
                        <p className="font-semibold text-destructive">生成失败</p>
                        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                            {generation?.errorMessage || "任务没有完成。如果已经扣费，将按账务结果处理退款。"}
                        </p>
                    </div>
                ) : resolvedImages.length === 0 ? (
                    <div className="relative flex min-h-[18rem] overflow-hidden rounded-lg border border-dashed bg-muted/10 px-4 text-center md:min-h-[28.5rem]">
                        {isStage ? (
                            <div className="ef-image-stage-grid" aria-hidden="true" />
                        ) : (
                            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-3 p-4 opacity-60">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "rounded-md border bg-background/70",
                                            index === 0 && "row-span-2",
                                            index === 3 && "col-span-2",
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="relative m-auto flex max-w-sm flex-col items-center text-center">
                            <div className="flex size-16 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-sm">
                                <Sparkles className="size-8" />
                            </div>
                            <p className="mt-4 font-semibold">画面还没开始</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                输入提示词后提交生成，结果会停在这里等待你挑选。
                            </p>
                            <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                                {["待开始", "排队中", "生成中", "处理结果"].map((step, index) => (
                                    <span
                                        key={step}
                                        className={cn(
                                            "rounded-md border bg-background px-2 py-1.5",
                                            index === 0 && "border-primary/35 bg-primary/5 text-primary",
                                        )}
                                    >
                                        {step}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {onOpenCanvas && (
                            <Button className="w-full gap-2 sm:hidden" onClick={onOpenCanvas}>
                                <LayoutPanelTop className="size-4" />
                                整理到画布
                            </Button>
                        )}
                        <div
                            className={cn(
                                "grid gap-3",
                                resolvedImages.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
                            )}
                        >
                            {resolvedImages.map((image, index) => {
                                const src = resolveImageSrc(image);
                                return (
                                    <div key={index} className="group overflow-hidden rounded-lg border bg-background shadow-sm transition hover:border-primary/25 hover:shadow-md">
                                        {src ? (
                                            <>
                                                <div className="relative aspect-square overflow-hidden">
                                                    <img
                                                        src={src}
                                                        alt={`生成图片 ${index + 1}`}
                                                        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                                                        {onOpenCanvas && (
                                                            <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" onClick={onOpenCanvas}>
                                                                <LayoutPanelTop className="size-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" onClick={() => window.open(src, "_blank", "noopener,noreferrer")}>
                                                            <ExternalLink className="size-3.5" />
                                                        </Button>
                                                        <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" onClick={() => downloadImage(src, `echoflow-image-${generation?.id || "result"}-${index + 1}.png`)}>
                                                            <Download className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                                    <span className="text-xs text-muted-foreground">
                                                        {resolvedImages.length > 1 ? `结果 ${index + 1}` : "生成结果"}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex aspect-square items-center justify-center bg-muted">
                                                <ImageIcon className="size-10 text-muted-foreground" />
                                            </div>
                                        )}
                                        {image.revisedPrompt && (
                                            <div className="flex items-start gap-2 border-t px-3 py-2.5">
                                                <p className="line-clamp-2 flex-1 text-xs italic text-muted-foreground">
                                                    &ldquo;{image.revisedPrompt}&rdquo;
                                                </p>
                                                <Button size="icon-sm" variant="ghost" className="-mr-1 shrink-0" onClick={() => copyText(image.revisedPrompt)}>
                                                    <Copy className="size-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
