import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { History, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ErrorState } from "../components/error-state";
import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { ResultGallery } from "../components/result-gallery";
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

    const navigate = useNavigate();
    const [currentGeneration, setCurrentGeneration] = useState<ImageGeneration | undefined>();
    const [reuseValues, setReuseValues] = useState<Partial<CreateGenerationParams> | undefined>();

    const {
        data: historyData,
        isLoading: historyLoading,
        isError: historyError,
        refetch: refetchHistory,
    } = useWebGenerationListQuery({ page: 1, pageSize: 6 }, { enabled: false });
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
    }, [refreshedGeneration?.id, refreshedGeneration?.status]);

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
            maskImageUrl: generation.maskImage?.url,
            maskImageFileId: generation.maskImage?.fileId,
            modelId: generation.modelConfigId ?? generation.modelId,
            size: generation.size,
            n: generation.n,
            quality: generation.quality,
            style: generation.style,
            responseFormat: generation.responseFormat,
        });
        toast.success("已复用参数到创作台");
    };

    const isGenerating = createMutation.isPending || retryMutation.isPending || currentIsRunning;

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6 lg:p-8">
            <div className="rounded-md border bg-card p-4 shadow-sm md:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">主站生图模型</Badge>
                            <Badge variant="outline">OpenAI-compatible Images API</Badge>
                        </div>
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                                <WandSparkles className="size-5 text-primary-foreground" />
                            </div>
                            AI 绘画
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            直接使用主系统已启用的生图模型。插件只保留参数覆盖、计费策略、风控和历史记录。
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate("history")}>
                            <History className="size-4" />
                            全部历史
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)] xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.85fr)]">
                <div className="space-y-6">
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
                </div>

                <div className="space-y-6">
                    <ResultGallery generation={currentGeneration} isLoading={isGenerating && !currentGeneration?.resultImages?.length} />

                    {historyError ? (
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
                            description="保留最近生成结果，方便继续查看或重试"
                            onDelete={handleDelete}
                            onRetry={handleRetry}
                            onReuse={handleReuse}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
