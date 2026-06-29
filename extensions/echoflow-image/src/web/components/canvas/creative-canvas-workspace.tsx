import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { CreateGenerationParams, ImageGeneration } from "../../services/types/generation";
import { ImageGenerationStatus } from "../../services/types/generation";
import { GenerationFlowCanvas } from "./generation-flow-canvas";
import { InspirationBoard } from "./inspiration-board";

interface CreativeCanvasWorkspaceProps {
    generation?: ImageGeneration;
    onReturnToGenerate?: () => void;
    onContinueFromImage?: (values: Partial<CreateGenerationParams>) => void;
}

function getStatusLabel(generation?: ImageGeneration) {
    if (!generation) return "等待生成";
    if (generation.status === ImageGenerationStatus.SUCCEEDED) return "结果已到达";
    if (generation.status === ImageGenerationStatus.FAILED) return "生成失败";
    if (generation.status === ImageGenerationStatus.PROCESSING) return "生成中";
    return "排队中";
}

function getStatusTone(generation?: ImageGeneration) {
    if (!generation) return "secondary";
    if (generation.status === ImageGenerationStatus.FAILED) return "destructive";
    if (generation.status === ImageGenerationStatus.SUCCEEDED) return "default";
    return "secondary";
}

export function CreativeCanvasWorkspace({ generation, onReturnToGenerate, onContinueFromImage }: CreativeCanvasWorkspaceProps) {
    const copyPrompt = async () => {
        if (!generation?.prompt) {
            toast.info("当前还没有可复制的提示词");
            return;
        }
        try {
            await navigator.clipboard.writeText(generation.prompt);
            toast.success("已复制提示词");
        } catch {
            toast.error("复制失败，请手动选择文本");
        }
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside>
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-lg">当前创作</CardTitle>
                                <CardDescription>生成流上下文</CardDescription>
                            </div>
                            <Badge variant={getStatusTone(generation)}>{getStatusLabel(generation)}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1 rounded-lg border bg-background p-3 text-sm">
                            <p className="text-xs font-medium text-muted-foreground">提示词</p>
                            <p className="line-clamp-4">{generation?.prompt || "先在生成模式提交一次创作。"}</p>
                        </div>
                        <div className="space-y-1 rounded-lg border bg-background p-3 text-sm">
                            <p className="text-xs font-medium text-muted-foreground">配置</p>
                            <p className="truncate">
                                {[generation?.modelName || generation?.modelId || "选择模型", generation?.size || "1024x1024", generation?.quality || "标准"].join(" · ")}
                            </p>
                        </div>
                        <div className="space-y-1 rounded-lg border bg-background p-3 text-sm">
                            <p className="text-xs font-medium text-muted-foreground">结果</p>
                            <p>{generation?.resultImages?.length ?? 0} 张图片，可在创作流中继续生成分支。</p>
                        </div>
                        <div className="space-y-2 border-t pt-3">
                            <Button className="w-full justify-start gap-2" onClick={onReturnToGenerate}>
                                <Wand2 className="size-4" />
                                回到生成
                            </Button>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={copyPrompt}>
                                <Copy className="size-4" />
                                复制当前提示词
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                主画布保留生成分支；灵感白板用于手绘构图、圈重点和整理参考。
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </aside>

            <div className="space-y-4">
                <GenerationFlowCanvas generation={generation} onContinueFromImage={onContinueFromImage} />
                <InspirationBoard generation={generation} compact />
            </div>
        </div>
    );
}
