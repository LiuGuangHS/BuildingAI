import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { cn } from "@buildingai/ui/lib/utils";
import { Copy, Download, ExternalLink, ImageIcon, Images, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { GeneratedImageRecord, ImageGeneration } from "../services/types/generation";
import { ImageGenerationStatus } from "../services/types/generation";
import { downloadImage, resolveImageSrc } from "./image-utils";
import { ResultSkeleton } from "./skeleton-card";

interface ResultGalleryProps {
    generation?: ImageGeneration;
    images?: GeneratedImageRecord[];
    isLoading?: boolean;
}

export function ResultGallery({ generation, images, isLoading }: ResultGalleryProps) {
    const resolvedImages = images ?? generation?.resultImages ?? [];

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
                await new Promise((r) => setTimeout(r, 300));
                downloadImage(src, `echoflow-image-${generation?.id || "result"}-${i + 1}.png`);
            }
        }
    };

    return (
        <Card className={cn(
            "min-h-[480px] transition-all duration-300",
            resolvedImages.length > 0 && "border-primary/10 bg-gradient-to-br from-background via-background to-primary/[0.03] shadow-md",
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <div className={cn(
                                "flex size-8 items-center justify-center rounded-lg",
                                resolvedImages.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                            )}>
                                <ImageIcon className="size-4" />
                            </div>
                            生成结果
                        </CardTitle>
                        <CardDescription>
                            {resolvedImages.length > 0
                                ? `${resolvedImages.length} 张图片`
                                : "填写提示词并生成后，结果会显示在这里"}
                        </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
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
                                {generation.status === ImageGenerationStatus.SUCCEEDED ? "成功"
                                 : generation.status === ImageGenerationStatus.FAILED ? "失败"
                                 : generation.status === ImageGenerationStatus.PROCESSING ? "生成中"
                                 : generation.status}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <ResultSkeleton />
                ) : generation?.status === ImageGenerationStatus.FAILED ? (
                    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/[0.03] px-4 text-center">
                        <div className="mb-4 rounded-full bg-destructive/10 p-3">
                            <ImageIcon className="size-8 text-destructive" />
                        </div>
                        <p className="font-semibold text-destructive">生成失败</p>
                        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                            {generation?.errorMessage || "未知错误，请重试"}
                        </p>
                    </div>
                ) : resolvedImages.length === 0 ? (
                    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 text-center">
                        <div className="mb-4 rounded-full bg-muted/50 p-4">
                            <Sparkles className="size-8 text-muted-foreground/60" />
                        </div>
                        <p className="font-medium text-muted-foreground">等待创作</p>
                        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground/70">
                            输入提示词，选择模型，点击生成按钮，你的作品就会在这里呈现
                        </p>
                    </div>
                ) : (
                    <div className={cn(
                        "grid gap-3",
                        resolvedImages.length === 1 ? "grid-cols-1" : "grid-cols-1 @md:grid-cols-2",
                    )}>
                        {resolvedImages.map((image, index) => {
                            const src = resolveImageSrc(image);
                            return (
                                <div key={index} className="group relative overflow-hidden rounded-xl border bg-background shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                                    {src ? (
                                        <>
                                            <div className="relative aspect-square overflow-hidden">
                                                <img
                                                    src={src}
                                                    alt={`生成图片 ${index + 1}`}
                                                    className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                                                    loading="lazy"
                                                />
                                                {/* Mobile: always-visible actions, Desktop: hover */}
                                                <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/50 via-black/20 to-transparent p-3 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                                                    <Button
                                                        size="icon-sm"
                                                        variant="secondary"
                                                        className="size-8 bg-white/90 hover:bg-white"
                                                        onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
                                                    >
                                                        <ExternalLink className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="icon-sm"
                                                        variant="secondary"
                                                        className="size-8 bg-white/90 hover:bg-white"
                                                        onClick={() => downloadImage(src, `echoflow-image-${generation?.id || "result"}-${index + 1}.png`)}
                                                    >
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
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                className="-mr-1 shrink-0"
                                                onClick={() => copyText(image.revisedPrompt)}
                                            >
                                                <Copy className="size-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}