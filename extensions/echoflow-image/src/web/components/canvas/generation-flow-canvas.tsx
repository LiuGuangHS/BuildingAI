import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { getLocalStorage, safeJsonParse, safeJsonStringify } from "@buildingai/stores";
import { cn } from "@buildingai/ui/lib/utils";
import { Copy, Download, ExternalLink, GitBranch, ImageIcon, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { CreateGenerationParams, GeneratedImageRecord, ImageGeneration } from "../../services/types/generation";
import { ImageGenerationStatus } from "../../services/types/generation";
import { ControlledImage } from "../controlled-image";
import { downloadImage, openImage } from "../image-utils";

const FLOW_STORAGE_KEY = "echoflow-image:generation-flow:v1";
const MAX_FLOW_GROUPS = 20;

interface FlowCanvasState {
    version: 1;
    groups: FlowGenerationGroup[];
    pendingParentImageId?: string;
}

interface FlowGenerationGroup {
    id: string;
    generationId: string;
    parentImageId?: string;
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    modelName?: string;
    size: string;
    n: number;
    quality?: string;
    style?: string;
    status: ImageGeneration["status"];
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    images: FlowImageNode[];
}

interface FlowImageNode {
    id: string;
    generationId: string;
    index: number;
    image: GeneratedImageRecord;
}

interface GenerationFlowCanvasProps {
    generation?: ImageGeneration;
    onContinueFromImage?: (values: Partial<CreateGenerationParams>) => void;
}

const emptyFlowState = (): FlowCanvasState => ({ version: 1, groups: [] });

function loadFlowState(): FlowCanvasState {
    try {
        const raw = getLocalStorage().getItem(FLOW_STORAGE_KEY);
        if (!raw) return emptyFlowState();
        const parsed = safeJsonParse<Partial<FlowCanvasState>>(raw);
        if (parsed?.version !== 1 || !Array.isArray(parsed.groups)) return emptyFlowState();
        return { version: 1, groups: parsed.groups.slice(0, MAX_FLOW_GROUPS), pendingParentImageId: parsed.pendingParentImageId };
    } catch {
        return emptyFlowState();
    }
}

function saveFlowState(state: FlowCanvasState) {
    try {
        getLocalStorage().setItem(FLOW_STORAGE_KEY, safeJsonStringify(state));
    } catch {
        // LocalStorage can fill up with image data; losing the local canvas is better than breaking generation.
    }
}

function getStatusLabel(status: ImageGeneration["status"]) {
    if (status === ImageGenerationStatus.SUCCEEDED) return "成功";
    if (status === ImageGenerationStatus.FAILED) return "失败";
    if (status === ImageGenerationStatus.PROCESSING) return "生成中";
    return "等待中";
}

function getStatusVariant(status: ImageGeneration["status"]) {
    if (status === ImageGenerationStatus.SUCCEEDED) return "default";
    if (status === ImageGenerationStatus.FAILED) return "destructive";
    if (status === ImageGenerationStatus.PROCESSING) return "secondary";
    return "outline";
}

function generationToGroup(generation: ImageGeneration, parentImageId?: string): FlowGenerationGroup {
    return {
        id: generation.id,
        generationId: generation.id,
        parentImageId,
        prompt: generation.prompt,
        negativePrompt: generation.negativePrompt,
        modelId: generation.modelId,
        modelName: generation.modelName,
        size: generation.size,
        n: generation.n,
        quality: generation.quality,
        style: generation.style,
        status: generation.status,
        errorMessage: generation.errorMessage,
        createdAt: generation.createdAt,
        updatedAt: generation.updatedAt,
        images: generation.resultImages.map((image, index) => ({
            id: `${generation.id}:${index}`,
            generationId: generation.id,
            index,
            image,
        })),
    };
}

function upsertGeneration(state: FlowCanvasState, generation: ImageGeneration): FlowCanvasState {
    const existingIndex = state.groups.findIndex((group) => group.generationId === generation.id);
    const parentImageId = existingIndex >= 0 ? state.groups[existingIndex].parentImageId : state.pendingParentImageId;
    const nextGroup = generationToGroup(generation, parentImageId);
    const groups = existingIndex >= 0
        ? state.groups.map((group, index) => (index === existingIndex ? { ...nextGroup, parentImageId: group.parentImageId } : group))
        : [nextGroup, ...state.groups].slice(0, MAX_FLOW_GROUPS);
    return { version: 1, groups, pendingParentImageId: existingIndex >= 0 ? state.pendingParentImageId : undefined };
}

function groupChildrenByParent(groups: FlowGenerationGroup[]) {
    const map = new Map<string, FlowGenerationGroup[]>();
    for (const group of groups) {
        if (!group.parentImageId) continue;
        const children = map.get(group.parentImageId) ?? [];
        children.push(group);
        map.set(group.parentImageId, children);
    }
    return map;
}

export function GenerationFlowCanvas({ generation, onContinueFromImage }: GenerationFlowCanvasProps) {
    const [state, setState] = useState<FlowCanvasState>(() => loadFlowState());

    useEffect(() => {
        if (!generation) return;
        setState((prev) => upsertGeneration(prev, generation));
    }, [generation?.id, generation?.status, generation?.updatedAt, generation?.resultImages]);

    useEffect(() => {
        saveFlowState(state);
    }, [state]);

    const childrenByParent = useMemo(() => groupChildrenByParent(state.groups), [state.groups]);
    const roots = useMemo(() => state.groups.filter((group) => !group.parentImageId), [state.groups]);
    const canContinueFromImage = Boolean(onContinueFromImage);

    const clearFlow = () => {
        setState(emptyFlowState());
        toast.success("已清空本地创作流");
    };

    const copyText = async (text?: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            toast.success("已复制提示词");
        } catch {
            toast.error("复制失败，请手动选择文本");
        }
    };

    const continueFromImage = (group: FlowGenerationGroup, image: FlowImageNode) => {
        if (!canContinueFromImage) {
            toast.info("参考图生成能力将在后续版本开放");
            return;
        }
        setState((prev) => ({ ...prev, pendingParentImageId: image.id }));
        onContinueFromImage?.({
            prompt: image.image.revisedPrompt || group.prompt,
            negativePrompt: group.negativePrompt,
            referenceImageFileId: image.image.fileId,
            sourceImages: [{ fileId: image.image.fileId, mimeType: image.image.mimeType }],
            modelId: group.modelId,
            size: group.size,
            n: group.n,
            quality: group.quality,
            style: group.style,
        });
    };

    const renderGroup = (group: FlowGenerationGroup, depth = 0) => (
        <div key={group.id} className={cn("relative", depth > 0 && "ml-4 border-l pl-4 md:ml-6 md:pl-5")}>
            <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b bg-card/80 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="line-clamp-1 text-base">{group.prompt || "未命名创作"}</CardTitle>
                                <Badge variant={getStatusVariant(group.status)}>{getStatusLabel(group.status)}</Badge>
                            </div>
                            <CardDescription className="mt-1 truncate">
                                {(group.modelName || group.modelId)} · {group.size} · {group.quality || "标准"}
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => copyText(group.prompt)}>
                            <Copy className="size-3.5" />
                            复制提示词
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    {group.errorMessage && (
                        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {group.errorMessage}
                        </p>
                    )}
                    {group.images.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {group.images.map((image) => {
                                const childGroups = childrenByParent.get(image.id) ?? [];
                                return (
                                    <div key={image.id} className="space-y-3">
                                        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                                            <div className="aspect-square bg-muted">
                                                {image.image.fileId ? (
                                                    <ControlledImage image={image.image} generationId={group.generationId} alt={`生成图 ${image.index + 1}`} className="size-full object-cover" />
                                                ) : (
                                                    <div className="flex size-full items-center justify-center">
                                                        <ImageIcon className="size-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 p-2.5">
                                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                    <span>结果 {image.index + 1}</span>
                                                    {childGroups.length > 0 && <Badge variant="outline">{childGroups.length} 分支</Badge>}
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <Button size="sm" className="gap-1.5" disabled={!image.image.fileId || !canContinueFromImage} onClick={() => continueFromImage(group, image)}>
                                                        <GitBranch className="size-3.5" />
                                                        {canContinueFromImage ? "继续生成" : "待模型支持"}
                                                    </Button>
                                                    <Button size="sm" variant="outline" disabled={!image.image.fileId} aria-label="打开图片" onClick={() => void openImage(image.image, group.generationId)}>
                                                        <ExternalLink className="size-3.5" />
                                                        打开
                                                    </Button>
                                                    <Button size="sm" variant="outline" disabled={!image.image.fileId} aria-label="下载图片" onClick={() => void downloadImage(image.image, group.generationId, `echoflow-flow-${group.generationId}-${image.index + 1}.png`)}>
                                                        <Download className="size-3.5" />
                                                        下载
                                                    </Button>
                                                    <Button size="sm" variant="outline" disabled={!image.image.revisedPrompt} aria-label="复制优化提示词" onClick={() => copyText(image.image.revisedPrompt)}>
                                                        <Copy className="size-3.5" />
                                                        提示词
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        {childGroups.map((child) => renderGroup(child, depth + 1))}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted/10 text-center text-sm text-muted-foreground">
                            {group.status === ImageGenerationStatus.FAILED ? "本次生成没有可用结果" : "生成结果会出现在这里"}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    return (
        <Card className="overflow-hidden">
            <CardHeader className="border-b bg-card/80">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle className="text-xl">创作流画布</CardTitle>
                        <CardDescription>保留生成结果、参数和分支线索；参考图继续生成待模型支持后开放。</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => generation && setState((prev) => upsertGeneration(prev, generation))} disabled={!generation}>
                            <RefreshCcw className="size-4" />
                            加入当前生成
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={clearFlow} disabled={state.groups.length === 0}>
                            <Trash2 className="size-4" />
                            清空
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[720px] min-h-[520px] overflow-auto bg-muted/20 p-4">
                    {roots.length ? (
                        <div className="min-w-[760px] space-y-4">
                            {roots.map((group) => renderGroup(group))}
                        </div>
                    ) : (
                        <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-dashed bg-background/80 p-8 text-center">
                            <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
                                <GitBranch className="size-8" />
                            </div>
                            <h3 className="text-lg font-semibold">还没有创作分支</h3>
                            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                在生成模式提交一次图片，结果会自动进入这里；参考图分支生成将在后续版本开放。
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
