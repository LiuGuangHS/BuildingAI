import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "../components/error-state";
import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { ResultGallery } from "../components/result-gallery";
import { CreativeCanvasWorkspace } from "../components/canvas/creative-canvas-workspace";
import { QuickGeneratePanel } from "../components/panels/quick-generate-panel";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import type { WorkspaceMode } from "../components/workspace/mode-switch";
import {
    useWebCreateGenerationMutation,
    useWebDeleteGenerationMutation,
    useWebGenerationDetailQuery,
    useWebEstimateBillingMutation,
    useWebGenerationListQuery,
    useWebImageModelOptionsQuery,
    useWebPromptEnhanceMutation,
    useWebRetryGenerationMutation,
    useWebTemplatesQuery,
} from "../services";
import type { CreateGenerationParams, ImageGeneration } from "../services/types/generation";
import { ImageGenerationStatus } from "../services/types/generation";

export default function EchoflowImagePublicPage() {
    useDocumentHead({ title: "AI图像工作台" });

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
        toast.success("已复用参数到创作台");
    };

    const isGenerating = createMutation.isPending || retryMutation.isPending || currentIsRunning;
    const quickResult = useMemo(
        () => (
            <ResultGallery
                generation={currentGeneration}
                isLoading={isGenerating && !currentGeneration?.resultImages?.length}
                onOpenCanvas={() => setMode("canvas")}
            />
        ),
        [currentGeneration, isGenerating],
    );
    const quickHistory = useMemo(
        () =>
            historyError ? (
                <ErrorState
                    title="加载历史失败"
                    message="无法获取最近作品，请检查网络后重试"
                    onRetry={() => refetchHistory()}
                />
            ) : (
                <HistoryList
                    items={historyData?.items || []}
                    loading={historyLoading}
                    detailBasePath="history"
                    title="最近作品"
                    description="点击缩略图查看、复用或重试"
                    compact
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            refetchHistory()
                        }
                    >
                        刷新历史
                    </Button>
                ) : null
            }
        >
            {mode === "quick" ? (
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
                            toast.success(result.source === "ai" ? "已使用 AI 润色提示词" : "已使用本地规则润色提示词");
                            return result;
                        }}
                        onSubmit={handleSubmit}
                    />
                </QuickGeneratePanel>
            ) : (
                <CreativeCanvasWorkspace generation={currentGeneration} onReturnToGenerate={() => setMode("quick")} />
            )}
        </WorkspaceShell>
    );
}
