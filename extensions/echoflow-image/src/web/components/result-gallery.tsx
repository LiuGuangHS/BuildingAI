import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { cn } from "@buildingai/ui/lib/utils";
import { Copy, Download, ExternalLink, ImageIcon, Images, LayoutPanelTop, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { CreateGenerationParams, GeneratedImageRecord, ImageGeneration } from "../services/types/generation";
import { ImageGenerationStatus } from "../services/types/generation";
import { downloadImage, resolveImageSrc } from "./image-utils";
import { ResultSkeleton } from "./skeleton-card";

interface ResultGalleryProps {
    generation?: ImageGeneration;
    images?: GeneratedImageRecord[];
    isLoading?: boolean;
    onOpenCanvas?: () => void;
    onUsePrompt?: (prompt: string) => void;
    onContinueFromImage?: (values: Partial<CreateGenerationParams>) => void;
    variant?: "card" | "stage";
}

const emptyPromptSuggestions = [
    { label: "未来城市", mark: "城", prompt: "赛博朋克风格的未来城市夜景，霓虹灯、雨后街道、电影感光影，超清细节" },
    { label: "产品海报", mark: "品", prompt: "高端护肤品商业海报，干净浅色背景，柔和工作室光，材质清晰，精致排版" },
    { label: "自然风景", mark: "景", prompt: "清晨山谷湖泊，薄雾、雪山倒影、自然柔光，宽画幅摄影，画面干净" },
];

function getStatusLabel(status?: ImageGenerationStatus | string) {
    if (status === ImageGenerationStatus.SUCCEEDED) return "已完成";
    if (status === ImageGenerationStatus.FAILED) return "失败";
    if (status === ImageGenerationStatus.PROCESSING) return "生成中";
    if (status === ImageGenerationStatus.PENDING) return "排队中";
    return status;
}

function getRunningStage(status?: ImageGenerationStatus | string) {
    if (status === ImageGenerationStatus.PENDING) return "排队中";
    if (status === ImageGenerationStatus.PROCESSING) return "生成中";
    return "处理结果";
}

export function ResultGallery({
    generation,
    images,
    isLoading,
    onOpenCanvas,
    onUsePrompt,
    onContinueFromImage,
    variant = "card",
}: ResultGalleryProps) {
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

    const continueFromImage = (image: GeneratedImageRecord) => {
        const src = resolveImageSrc(image);
        if (!src) {
            toast.info("这张图片暂时不能作为参考图");
            return;
        }
        onContinueFromImage?.({
            prompt: image.revisedPrompt || generation?.prompt || "",
            negativePrompt: generation?.negativePrompt,
            referenceImageUrl: src,
            sourceImages: [{ url: src, mimeType: image.mimeType }],
            modelId: generation?.modelId,
            size: generation?.size,
            n: generation?.n,
            quality: generation?.quality,
            style: generation?.style,
        });
    };

    return (
        <Card
            className={cn(
                "gap-0 overflow-hidden rounded-lg py-0 shadow-sm",
                isStage && "ef-image-light-table min-h-[28rem] md:min-h-[34rem]",
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
                                <h2 className={cn("truncate font-semibold", isStage ? "text-base" : "text-lg")}>生成结果</h2>
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
                                className={cn("shrink-0", generation.status !== ImageGenerationStatus.FAILED && "ef-image-mask-tape")}
                            >
                                {getStatusLabel(generation.status)}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <CardContent className={cn(isStage ? "p-3 md:p-4" : "p-4 md:p-5")}>
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/10 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">{getRunningStage(generation?.status)}</p>
                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                        {generation?.prompt || "正在准备本次图片任务。"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-1.5 text-xs">
                                    {["排队中", "生成中", "处理结果", "即将完成"].map((step) => (
                                        <span
                                            key={step}
                                            className={cn(
                                                "rounded-md border bg-background px-2 py-1",
                                                step === getRunningStage(generation?.status) && "border-primary/35 bg-primary/5 text-primary",
                                            )}
                                        >
                                            {step}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <ResultSkeleton />
                    </div>
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
                                输入提示词后提交生成，结果会显示在这里。
                            </p>
                            <div className="mt-6 grid w-full gap-2 text-left">
                                {emptyPromptSuggestions.map((suggestion) => (
                                    <Button
                                        key={suggestion.label}
                                        type="button"
                                        variant="outline"
                                        disabled={!onUsePrompt}
                                        onClick={() => onUsePrompt?.(suggestion.prompt)}
                                        className="h-auto justify-start gap-2 rounded-md bg-background p-2 text-left shadow-xs hover:border-primary/30 hover:bg-primary/[0.03]"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground"
                                        >
                                            {suggestion.mark}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-xs font-medium">{suggestion.label}</span>
                                            <span className="line-clamp-1 text-[11px] font-normal text-muted-foreground">
                                                {suggestion.prompt}
                                            </span>
                                        </span>
                                    </Button>
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
                                    <div key={index} className="ef-image-contact-frame group overflow-hidden rounded-lg border bg-background shadow-sm transition hover:border-primary/25 hover:shadow-md">
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
                                                        {onContinueFromImage && generation && (
                                                            <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" aria-label="作为参考图继续生成" onClick={() => continueFromImage(image)}>
                                                                <Sparkles className="size-3.5" />
                                                            </Button>
                                                        )}
                                                        {onOpenCanvas && (
                                                            <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" aria-label="整理到画布" onClick={onOpenCanvas}>
                                                                <LayoutPanelTop className="size-3.5" />
                                                            </Button>
                                                        )}
                                                        {(image.revisedPrompt || generation?.prompt) && (
                                                            <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" aria-label="复制提示词" onClick={() => copyText(image.revisedPrompt || generation?.prompt)}>
                                                                <Copy className="size-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" aria-label="打开图片" onClick={() => window.open(src, "_blank", "noopener,noreferrer")}>
                                                            <ExternalLink className="size-3.5" />
                                                        </Button>
                                                        <Button size="icon-sm" variant="secondary" className="size-8 bg-white/90 hover:bg-white" aria-label="下载图片" onClick={() => downloadImage(src, `echoflow-image-${generation?.id || "result"}-${index + 1}.png`)}>
                                                            <Download className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
                                                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                                        {resolvedImages.length > 1 ? `Frame ${String(index + 1).padStart(2, "0")}` : "Frame 01"}
                                                    </span>
                                                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                                        {[generation?.size, generation?.quality || "standard"].filter(Boolean).join(" · ")}
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
                                                <Button size="icon-sm" variant="ghost" className="-mr-1 shrink-0" aria-label="复制优化提示词" onClick={() => copyText(image.revisedPrompt)}>
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
