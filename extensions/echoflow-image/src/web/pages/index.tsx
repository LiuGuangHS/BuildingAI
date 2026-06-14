import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { History, ImageIcon, Sparkles, WandSparkles } from "lucide-react";
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
    const latestSucceeded = historyData?.items?.filter((item) => item.status === "succeeded").length ?? 0;

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6 lg:p-8">
            {/* Header Card */}
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-5 shadow-sm md:p-6">
                <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-4 right-12 size-24 rounded-full bg-purple-500/5 blur-2xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant="secondary" className="mb-2 bg-background/60 backdrop-blur">
                            OpenAI-compatible Images API
                        </Badge>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-md shadow-primary/20">
                                <WandSparkles className="size-5 text-primary-foreground" />
                            </div>
                            AI 绘画
                        </h1>
                        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                            输入提示词，选择模型，一键生成精美图片。最近作品会在右侧即时沉淀。
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border bg-background/60 px-3 py-2.5 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <ImageIcon className="size-3" />
                                    可用模型
                                </div>
                                <div className="mt-0.5 text-lg font-bold">{modelsLoading ? "-" : models.length}</div>
                            </div>
                            <div className="rounded-lg border bg-background/60 px-3 py-2.5 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Sparkles className="size-3" />
                                    近期成功
                                </div>
                                <div className="mt-0.5 text-lg font-bold">{latestSucceeded}</div>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate("history")}>
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
                                modelConfigId: data.modelId,
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
