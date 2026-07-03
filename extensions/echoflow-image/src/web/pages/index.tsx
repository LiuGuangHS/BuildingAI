import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { ResultGallery } from "../components/result-gallery";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import type { WorkspaceMode } from "../components/workspace/mode-switch";
import {
    useWebCreateGenerationMutation,
    useWebDeleteGenerationMutation,
    useWebEstimateBillingMutation,
    useWebGenerationDetailQuery,
    useWebGenerationListQuery,
    useWebImageModelOptionsQuery,
    useWebPromptEnhanceMutation,
    useWebRetryGenerationMutation,
    useWebTemplatesQuery,
} from "../services";
import type { CreateGenerationParams, ImageGeneration } from "../services/types/generation";
import { ImageGenerationStatus } from "../services/types/generation";

const CreativeCanvasWorkspace = lazy(() => import("../components/canvas/creative-canvas-workspace").then((module) => ({
    default: module.CreativeCanvasWorkspace,
})));

function CanvasLoading() {
    return (
        <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="h-5 w-28 rounded bg-muted" />
                <div className="mt-4 space-y-2">
                    <div className="h-20 rounded-md bg-muted/70" />
                    <div className="h-20 rounded-md bg-muted/50" />
                    <div className="h-10 rounded-md bg-muted/60" />
                </div>
            </div>
            <div className="min-h-[520px] rounded-lg border bg-card p-4 shadow-sm">
                <div className="h-6 w-40 rounded bg-muted" />
                <div className="mt-4 h-[440px] rounded-lg border border-dashed bg-muted/30" />
            </div>
        </div>
    );
}

export default function EchoflowImagePublicPage() {
    useDocumentHead({ title: "EchoFlowAI 绘画" });

    const [currentGeneration, setCurrentGeneration] = useState<ImageGeneration | undefined>();
    const [reuseValues, setReuseValues] = useState<Partial<CreateGenerationParams> | undefined>();
    const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("quick");

    const {
        data: historyData,
        isLoading: historyLoading,
        isError: historyError,
        refetch: refetchHistory,
    } = useWebGenerationListQuery({ page: 1, pageSize: 6 });
    const { data: models = [], isLoading: modelsLoading, isError: modelsError } = useWebImageModelOptionsQuery();
    const { data: templateData } = useWebTemplatesQuery({ page: 1, pageSize: 20 });

    const createMutation = useWebCreateGenerationMutation();
    const deleteMutation = useWebDeleteGenerationMutation();
    const retryMutation = useWebRetryGenerationMutation();
    const estimateMutation = useWebEstimateBillingMutation();
    const promptEnhanceMutation = useWebPromptEnhanceMutation();
    const currentIsRunning =
        currentGeneration?.status === ImageGenerationStatus.PENDING ||
        currentGeneration?.status === ImageGenerationStatus.PROCESSING;
    const { data: refreshedGeneration } = useWebGenerationDetailQuery(currentGeneration?.id ?? "", {
        enabled: Boolean(currentGeneration?.id && currentIsRunning),
        refetchInterval: currentIsRunning ? 2000 : false,
        staleTime: 0,
    });

    useEffect(() => {
        if (!refreshedGeneration) return;
        setCurrentGeneration(refreshedGeneration);
        if (
            refreshedGeneration.status === ImageGenerationStatus.SUCCEEDED ||
            refreshedGeneration.status === ImageGenerationStatus.FAILED
        ) {
            refetchHistory();
        }
    }, [refreshedGeneration?.id, refreshedGeneration?.status, refetchHistory]);

    const handleSubmit = async (data: CreateGenerationParams) => {
        try {
            const generation = await createMutation.mutateAsync(data);
            setCurrentGeneration(generation);
            toast.success("生成任务已提交");
            refetchHistory();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "图片生成失败");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
            toast.success("删除成功");
            refetchHistory();
        } catch {
            toast.error("删除失败");
        }
    };

    const handleRetry = async (id: string) => {
        try {
            const generation = await retryMutation.mutateAsync(id);
            setCurrentGeneration(generation);
            toast.success("重试任务已提交");
            refetchHistory();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "重新生成失败");
        }
    };

    const handleReuse = (generation: ImageGeneration) => {
        setReuseValues({
            prompt: generation.prompt,
            negativePrompt: generation.negativePrompt,
            referenceImageUrl: generation.referenceImageUrl,
            referenceImageFileId: generation.referenceImageFileId,
            sourceImages: generation.sourceImages,
            modelId: generation.modelId,
            size: generation.size,
            n: generation.n,
            quality: generation.quality,
            style: generation.style,
            responseFormat: generation.responseFormat,
        });
        toast.success("参数已回填");
    };

    const handleContinueFromImage = (values: Partial<CreateGenerationParams>) => {
        setReuseValues(values);
        setWorkspaceMode("quick");
        toast.success("已填入参考图，可继续生成分支");
    };

    const isGenerating = createMutation.isPending || retryMutation.isPending || currentIsRunning;
    const quickResult = useMemo(
        () => (
            <ResultGallery
                generation={currentGeneration}
                isLoading={isGenerating && !currentGeneration?.resultImages?.length}
                variant="stage"
            />
        ),
        [currentGeneration, isGenerating],
    );
    const quickHistory = useMemo(
        () =>
            historyError ? (
                <section className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold">最近作品</h2>
                            <p className="truncate text-xs text-muted-foreground">最近作品暂时没有加载，当前生成不受影响。</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="rounded-md">
                            <span aria-hidden="true" className="text-xs leading-none">↻</span>
                            重试
                        </Button>
                    </div>
                </section>
            ) : (
                <HistoryList
                    items={historyData?.items || []}
                    loading={historyLoading}
                    detailBasePath="history"
                    title="最近作品"
                    description="复用参数或重试失败任务"
                    compact
                    variant="filmstrip"
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                    onReuse={handleReuse}
                />
            ),
        [historyData?.items, historyError, historyLoading, refetchHistory],
    );

    return (
        <WorkspaceShell
            mode={workspaceMode}
            onModeChange={setWorkspaceMode}
            quickActions={(
                <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="rounded-md">
                    <span aria-hidden="true" className="text-sm leading-none">↻</span>
                    <span className="hidden sm:inline">刷新</span>
                </Button>
            )}
        >
            {workspaceMode === "canvas" ? (
                <Suspense fallback={<CanvasLoading />}>
                    <CreativeCanvasWorkspace
                        generation={currentGeneration}
                        onReturnToGenerate={() => setWorkspaceMode("quick")}
                        onContinueFromImage={handleContinueFromImage}
                    />
                </Suspense>
            ) : (
                <div className="grid min-w-0 gap-2.5 xl:grid-cols-[minmax(340px,390px)_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[minmax(340px,390px)_minmax(0,1fr)_minmax(280px,340px)]">
                    <section className="min-w-0 xl:sticky xl:top-2.5">
                        <GenerationForm
                            loading={isGenerating}
                            models={models}
                            modelsLoading={modelsLoading}
                            modelsError={modelsError}
                            initialValues={reuseValues}
                            templates={templateData?.items ?? []}
                            estimatedPower={estimateMutation.data?.amount}
                            onEstimateChange={(data) => {
                                estimateMutation.mutate({
                                    modelConfigId: data.modelId,
                                    mode: data.mode,
                                    size: data.size,
                                    n: data.n,
                                    quality: data.quality,
                                });
                            }}
                            onEnhancePrompt={async (data) => {
                                try {
                                    const result = await promptEnhanceMutation.mutateAsync(data);
                                    toast.success("提示词已润色");
                                    return result;
                                } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "提示词润色失败");
                                    throw error;
                                }
                            }}
                            onSubmit={handleSubmit}
                        />
                    </section>

                    <main className="grid min-w-0 content-start gap-2.5">
                        <section className={cn("min-w-0 rounded-lg", isGenerating && "ring-1 ring-primary/25")}>
                            {quickResult}
                        </section>
                    </main>

                    <aside className="min-w-0 2xl:sticky 2xl:top-2.5">
                        {quickHistory}
                    </aside>
                </div>
            )}
        </WorkspaceShell>
    );
}
