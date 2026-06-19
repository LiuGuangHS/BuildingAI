import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Clapperboard, Film, History, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { GenerationForm } from "../components/generation-form";
import { HistoryList } from "../components/history-list";
import { VideoResult } from "../components/video-result";
import { createRequestKey } from "../lib/request-key";
import { readReuseParams } from "../lib/reuse-params-storage";
import {
    useWebCreateVideoMutation,
    useWebVideoTemplatesQuery,
    useWebVideoListQuery,
    useWebVideoModelOptionsQuery,
    useWebVideoStatusQuery,
} from "../services";
import type { CreateVideoParams } from "../services/types/generation";

export default function AIVideoIndexPage() {
    useDocumentHead({ title: "AI视频工作台" });

    const [currentId, setCurrentId] = useState<string | undefined>();
    const [formInitialValues, setFormInitialValues] = useState<Partial<CreateVideoParams>>();
    const navigate = useNavigate();

    const { data: models = [], isLoading: modelsLoading } = useWebVideoModelOptionsQuery();
    const { data: templateData } = useWebVideoTemplatesQuery({ page: 1, pageSize: 20 });
    const {
        data: historyData,
        isLoading: historyLoading,
    } = useWebVideoListQuery({ page: 1, pageSize: 6 }, { enabled: false });

    const createMutation = useWebCreateVideoMutation();
    const { data: currentGeneration } = useWebVideoStatusQuery(currentId);
    const disabledReason = !modelsLoading && models.length === 0
        ? "管理员尚未为视频模型配置可用接入点。"
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
            const requestKey = createRequestKey();
            const gen = await createMutation.mutateAsync({ ...data, requestKey });
            setCurrentId(gen.id);
            toast.success("任务已提交，正在生成视频...");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "任务提交失败");
        }
    };

    const handleReuse = (generation: {
        prompt: string;
        originalPrompt?: string;
        promptOptimizationSource?: "ai" | "local";
        promptOptimizationStyle?: string;
        promptOptimizerModelId?: string;
        model: string;
        media?: CreateVideoParams["media"];
        parameters: {
            resolution?: string;
            duration?: number;
            ratio?: string;
            watermark?: boolean;
            audio_setting?: string;
        };
    }) => {
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
        <div className="min-h-screen space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-2 shadow-sm">EchoFlow Video</Badge>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
                        <Film className="size-6 text-primary" />
                        AI视频工作台
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
                        选择生成方式、上传素材、提交任务，右侧实时查看结果和最近作品。
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:w-80">
                    <Card>
                        <CardContent className="flex items-center gap-2 p-3">
                            <Sparkles className="size-4 text-primary" />
                            <span className="text-xs text-muted-foreground">{models.length || 9} 个模型</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-2 p-3">
                            <History className="size-4 text-primary" />
                            <span className="text-xs text-muted-foreground">自动轮询</span>
                        </CardContent>
                    </Card>
                </div>
                <Button variant="outline" className="w-fit" onClick={() => navigate("studio")}>
                    <Clapperboard className="size-4" />
                    短视频制作
                </Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.85fr)]">
                <div className="space-y-6">
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
                </div>

                <div className="space-y-6">
                    <VideoResult
                        generation={currentGeneration}
                        isLoading={createMutation.isPending}
                        onReuse={handleReuse}
                    />
                    <HistoryList
                        items={historyData?.items || []}
                        loading={historyLoading}
                        showDelete={false}
                        detailBasePath=""
                    />
                    <Button variant="outline" className="w-full" onClick={() => navigate("history")}>
                        <History className="size-4" />
                        查看全部历史
                    </Button>
                </div>
            </div>
        </div>
    );
}
