import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { RefreshCcw } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { QuickGeneratePanel } from "../components/panels/quick-generate-panel";
import { ResultGallery } from "../components/result-gallery";
import type { WorkspaceMode } from "../components/workspace/mode-switch";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
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

const CreativeCanvasWorkspace = lazy(() =>
    import("../components/canvas/creative-canvas-workspace").then((module) => ({
        default: module.CreativeCanvasWorkspace,
    })),
);

function CanvasLoading() {
    return (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]" role="status" aria-live="polite">
            <div className="space-y-4">
                <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
            </div>
            <Skeleton className="min-h-[32rem] rounded-lg" />
        </div>
    );
}

export default function EchoflowImagePublicPage() {
    useDocumentHead({ title: "EchoFlowAI 绘画" });

    const [mode, setMode] = useState<WorkspaceMode>("quick");
    const [currentGeneration, setCurrentGeneration] = useState<ImageGeneration | undefined>();
    const [reuseValues, setReuseValues] = useState<Partial<CreateGenerationParams> | undefined>();

    const {
        data: historyData,
        isLoading: historyLoading,
        isError: historyError,
        refetch: refetchHistory,
    } = useWebGenerationListQuery({ page: 1, pageSize: 6 });
    const { data: models = [], isLoading: modelsLoading } = useWebImageModelOptionsQuery();
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
            modelId: generation.modelConfigId ?? generation.modelId,
            size: generation.size,
            n: generation.n,
            quality: generation.quality,
            style: generation.style,
            responseFormat: generation.responseFormat,
        });
        setMode("quick");
        toast.success("参数已回填");
    };

    const isGenerating = createMutation.isPending || retryMutation.isPending || currentIsRunning;
    const quickResult = useMemo(
        () => (
            <ResultGallery
                generation={currentGeneration}
                isLoading={isGenerating && !currentGeneration?.resultImages?.length}
                onOpenCanvas={() => setMode("canvas")}
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
                            <RefreshCcw className="size-3.5" />
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
            mode={mode}
            onModeChange={setMode}
            quickActions={
                mode === "quick" ? (
                    <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="rounded-md">
                        <RefreshCcw className="size-4" />
                        <span className="hidden sm:inline">刷新</span>
                    </Button>
                ) : null
            }
        >
            <div hidden={mode !== "quick"}>
                <QuickGeneratePanel isGenerating={isGenerating} result={quickResult} history={quickHistory}>
                    <GenerationForm
                        loading={isGenerating}
                        models={models}
                        modelsLoading={modelsLoading}
                        initialValues={reuseValues}
                        templates={templateData?.items ?? []}
                        estimatedPower={estimateMutation.data?.amount}
                        onEstimateChange={(data) => {
                            estimateMutation.mutate({
                                modelConfigId: data.pluginConfigId,
                                mode: data.mode,
                                size: data.size,
                                n: data.n,
                                quality: data.quality,
                            });
                        }}
                        onEnhancePrompt={async (data) => {
                            const result = await promptEnhanceMutation.mutateAsync(data);
                            toast.success(result.source === "ai" ? "提示词已润色" : "已用本地规则润色");
                            return result;
                        }}
                        onSubmit={handleSubmit}
                    />
                </QuickGeneratePanel>
            </div>
            {mode === "canvas" && (
                <Suspense fallback={<CanvasLoading />}>
                    <CreativeCanvasWorkspace generation={currentGeneration} onReturnToGenerate={() => setMode("quick")} />
                </Suspense>
            )}
        </WorkspaceShell>
    );
}
