import { useDocumentHead } from "@buildingai/hooks";
import { createRequestId } from "@buildingai/http";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Film, History, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { VideoResult } from "../components/video-result";
import { readReuseParams } from "../lib/reuse-params-storage";
import {
    useWebCreateVideoMutation,
    useWebVideoTemplatesQuery,
    useWebVideoListQuery,
    useWebVideoModelOptionsQuery,
    useWebVideoStatusQuery,
} from "../services";
import type { CreateVideoParams, VideoGeneration } from "../services/types/generation";

export default function AIVideoIndexPage() {
    useDocumentHead({ title: "视频生成" });

    const [currentId, setCurrentId] = useState<string | undefined>();
    const [formInitialValues, setFormInitialValues] = useState<Partial<CreateVideoParams>>();
    const navigate = useNavigate();

    const { data: models = [], isLoading: modelsLoading } = useWebVideoModelOptionsQuery();
    const { data: templateData } = useWebVideoTemplatesQuery({ page: 1, pageSize: 20 });
    const {
        data: historyData,
        isLoading: historyLoading,
    } = useWebVideoListQuery({ page: 1, pageSize: 6 });

    const createMutation = useWebCreateVideoMutation();
    const { data: currentGeneration } = useWebVideoStatusQuery(currentId);
    const availableModelCount = models.filter((model) => model.available && model.enabled && model.configured).length;
    const disabledReason = !modelsLoading && availableModelCount === 0
        ? "视频生成功能暂未开放，请稍后再来。"
        : undefined;

    useEffect(() => {
        const reuseParams = readReuseParams();
        if (reuseParams) {
            setFormInitialValues(reuseParams);
            toast.success("已回填生成参数");
        }
    }, []);

    const handleSubmit = async (data: CreateVideoParams) => {
        try {
            const requestKey = createRequestId();
            const gen = await createMutation.mutateAsync({ ...data, requestKey });
            setCurrentId(gen.id);
            toast.success("任务已提交，视频会排队生成");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "任务提交失败");
        }
    };

    const handleReuse = (generation: Pick<VideoGeneration,
        | "prompt"
        | "originalPrompt"
        | "promptOptimizationSource"
        | "promptOptimizationStyle"
        | "promptOptimizerModelId"
        | "model"
        | "media"
        | "parameters"
    >) => {
        setFormInitialValues({
            prompt: generation.prompt,
            originalPrompt: generation.originalPrompt,
            promptOptimizationSource: generation.promptOptimizationSource,
            promptOptimizationStyle: generation.promptOptimizationStyle,
            promptOptimizerModelId: generation.promptOptimizerModelId,
            model: generation.model,
            media: generation.media,
            resolution: generation.parameters.resolution,
            duration: generation.parameters.duration,
            ratio: generation.parameters.ratio,
            watermark: generation.parameters.watermark,
            audioSetting: generation.parameters.audio_setting,
        });
        toast.success("已回填生成参数");
    };

    return (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl">
                        <Film className="size-5 text-primary" />
                        视频生成
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        输入画面想法或上传参考素材，提交后进入队列生成；完成后可在结果区和历史中查看。
                    </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
                    <Badge variant={availableModelCount ? "default" : "secondary"} className="gap-1.5 px-2.5 py-1">
                        <Sparkles className="size-3.5" />
                        {modelsLoading ? "读取生成规格" : availableModelCount ? `${availableModelCount} 个规格可用` : "暂未开放"}
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
                        <RefreshCw className="size-3.5" />
                        异步生成
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
                        <ShieldCheck className="size-3.5" />
                        上传校验
                    </Badge>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.92fr)_minmax(520px,1.35fr)]">
                <GenerationForm
                    loading={createMutation.isPending}
                    models={models}
                    modelsLoading={modelsLoading}
                    disabledReason={disabledReason}
                    promptTemplates={(templateData?.items ?? []).map((item) => ({
                        label: item.title,
                        prompt: item.prompt,
                    }))}
                    initialValues={formInitialValues}
                    onSubmit={handleSubmit}
                />

                <VideoResult
                    generation={currentGeneration}
                    isLoading={createMutation.isPending}
                    onReuse={handleReuse}
                />
            </div>

            <HistoryList
                items={historyData?.items || []}
                loading={historyLoading}
                showDelete={false}
                detailBasePath=""
                variant="strip"
                onReuse={handleReuse}
                action={(
                    <Button variant="ghost" size="sm" onClick={() => navigate("history")}>
                        <History className="size-4" />
                        查看全部
                    </Button>
                )}
            />
        </div>
    );
}
