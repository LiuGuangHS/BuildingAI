import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { ArrowRight, CheckCircle2, Copy, LayoutPanelTop, ImagePlus, Layers3, Sparkles, Wand2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import type { ImageGeneration } from "../../services/types/generation";
import { ImageGenerationStatus } from "../../services/types/generation";
import { InspirationBoard } from "./inspiration-board";

interface CreativeCanvasWorkspaceProps {
    generation?: ImageGeneration;
    onReturnToGenerate?: () => void;
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

export function CreativeCanvasWorkspace({ generation, onReturnToGenerate }: CreativeCanvasWorkspaceProps) {
    const resultCount = generation?.resultImages?.length ?? 0;
    const workflowSteps = useMemo(
        () => [
            {
                title: "提示词",
                description: generation?.prompt || "从生成模式提交提示词后，这里会成为创作链起点。",
                icon: Sparkles,
                badge: "Prompt",
            },
            {
                title: "模型配置",
                description: [
                    generation?.modelName || generation?.modelId || "选择可用模型",
                    generation?.size || "1024x1024",
                    generation?.quality || "标准",
                ].join(" · "),
                icon: Layers3,
                badge: "Config",
            },
            {
                title: "结果入板",
                description: resultCount ? `${resultCount} 张结果可加入 tldraw 白板继续批注、拼贴或整理。` : "生成完成后，结果图会出现在素材区。",
                icon: ImagePlus,
                badge: "Output",
                done: resultCount > 0,
            },
        ],
        [generation?.modelId, generation?.modelName, generation?.prompt, generation?.quality, generation?.size, resultCount],
    );

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
        <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <LayoutPanelTop className="size-4" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">无限创作画布</h2>
                                <p className="text-sm text-muted-foreground">
                                    把生成结果放进 tldraw 白板，继续批注、拼贴、参考整理和导出。
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">tldraw</Badge>
                        <Badge variant={getStatusTone(generation)}>{getStatusLabel(generation)}</Badge>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">当前创作</CardTitle>
                            <CardDescription>提示词、模型和结果状态</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {workflowSteps.map((step, index) => {
                                const Icon = step.icon;
                                return (
                                    <div key={step.title} className="bg-background relative rounded-lg border p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                                                {step.done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{step.title}</span>
                                                    <Badge variant="secondary">{step.badge}</Badge>
                                                </div>
                                                <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{step.description}</p>
                                            </div>
                                        </div>
                                        {index < workflowSteps.length - 1 ? (
                                            <div className="text-muted-foreground mt-3 flex justify-center">
                                                <ArrowRight className="size-4 rotate-90" />
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">继续创作</CardTitle>
                            <CardDescription>白板整理灵感，生成模式继续出图</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full justify-start gap-2" onClick={onReturnToGenerate}>
                                <Wand2 className="size-4" />
                                回到生成模式
                            </Button>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={copyPrompt}>
                                <Copy className="size-4" />
                                复制当前提示词
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                结果入板后可在白板中批注、拼贴、导出，再回到生成模式继续迭代提示词。
                            </p>
                        </CardContent>
                    </Card>
                </aside>

                <InspirationBoard generation={generation} compact />
            </div>
        </div>
    );
}
