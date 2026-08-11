import { useDocumentHead } from "@buildingai/hooks";
import { createRequestId } from "@buildingai/http";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { History, RefreshCw, ShieldCheck, SquareStack } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
} from "../services/web";
import type { CreateVideoParams, VideoGeneration } from "../services/types/generation";

const WORKBENCH_TABS = [
    { label: "生成", path: "/" },
    { label: "历史", path: "history" },
    { label: "短视频", path: "studio" },
] as const;

export default function AIVideoIndexPage() {
    useDocumentHead({ title: "视频生成" });

    const [currentId, setCurrentId] = useState<string | undefined>();
    const [formInitialValues, setFormInitialValues] = useState<Partial<CreateVideoParams>>();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        data: models = [],
        isLoading: modelsLoading,
        isError: modelsError,
        refetch: refetchModels,
    } = useWebVideoModelOptionsQuery();
    const {
        data: templateData,
        isError: templatesError,
        refetch: refetchTemplates,
    } = useWebVideoTemplatesQuery({ page: 1, pageSize: 20 });
    const {
        data: historyData,
        isLoading: historyLoading,
        isError: historyError,
        refetch: refetchHistory,
    } = useWebVideoListQuery({ page: 1, pageSize: 6 });

    const createMutation = useWebCreateVideoMutation();
    const { data: currentGeneration } = useWebVideoStatusQuery(currentId);
    const availableModelCount = models.length;
    const disabledReason = !modelsError && !modelsLoading && availableModelCount === 0
        ? "视频生成功能暂未开放，请稍后再来。"
        : undefined;
    const recentHistory = useMemo(() => (historyData?.items ?? []).slice(0, 4), [historyData?.items]);

    useEffect(() => {
        if (templatesError) {
            toast.error("无法读取视频模板", {
                action: {
                    label: "重试",
                    onClick: () => refetchTemplates(),
                },
            });
        }
    }, [templatesError, refetchTemplates]);

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
        | "modelConfigId"
        | "media"
        | "parameters"
    >) => {
        setFormInitialValues({
            prompt: generation.prompt,
            originalPrompt: generation.originalPrompt,
            promptOptimizationSource: generation.promptOptimizationSource,
            promptOptimizationStyle: generation.promptOptimizationStyle,
            modelConfigId: generation.modelConfigId,
            media: generation.media,
            resolution: generation.parameters.resolution,
            duration: generation.parameters.duration,
            ratio: generation.parameters.ratio,
            watermark: generation.parameters.watermark,
        });
        toast.success("已回填生成参数");
    };

    return (
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 md:p-4">
            <header className="rounded-xl border bg-background/85 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 space-y-1">
                        <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
                            新视频任务
                        </h1>
                        <p className="truncate text-sm text-muted-foreground">
                            {currentGeneration ? "任务已提交，结果会在当前工作区更新。" : "填写画面、素材和规格后开始生成。"}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <Tabs value={activeTabValue(location.pathname)} onValueChange={(value) => navigate(value)}>
                            <TabsList className="h-9" aria-label="视频工作区">
                                {WORKBENCH_TABS.map((tab) => (
                                    <TabsTrigger key={tab.path} value={tab.path} className="gap-1.5 px-3">
                                        {tab.label === "短视频" ? <SquareStack className="size-4" /> : tab.label === "历史" ? <History className="size-4" /> : null}
                                        {tab.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
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
            </header>

            <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.94fr)_minmax(520px,1.18fr)_minmax(320px,0.72fr)]">
                <div className="space-y-3">
                    {modelsError ? (
                        <ErrorState title="加载生成规格失败" message="无法读取视频生成配置，请登录后重试。" onRetry={() => refetchModels()} />
                    ) : null}
                    <GenerationForm
                        loading={createMutation.isPending}
                        models={models}
                        modelsLoading={modelsLoading}
                        disabledReason={disabledReason}
                        promptTemplates={(templateData?.items ?? []).map((item) => ({
                            label: item.title,
                            prompt: item.prompt,
                            modelConfigId: item.modelConfigId,
                            defaultParams: item.defaultParams,
                        }))}
                        initialValues={formInitialValues}
                        onSubmit={handleSubmit}
                    />
                </div>

                <VideoResult
                    generation={currentGeneration}
                    isLoading={createMutation.isPending}
                    onReuse={handleReuse}
                />

                <aside className="space-y-3">
                    <div className="rounded-xl border bg-background/85 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-medium">最近生成</p>
                                <p className="text-xs text-muted-foreground">复用参数后可直接回填到左侧工作台。</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => navigate("history")}>
                                查看全部
                            </Button>
                        </div>
                    </div>
                    {historyError ? (
                        <ErrorState title="加载最近生成失败" message="无法读取最近的视频生成记录。" onRetry={() => refetchHistory()} />
                    ) : (
                        <HistoryList
                            items={recentHistory}
                            loading={historyLoading && !historyError}
                            showDelete={false}
                            detailBasePath=""
                            variant="compact"
                            onReuse={handleReuse}
                        />
                    )}
                </aside>
            </div>
        </div>
    );
}

function activeTabValue(pathname: string) {
    if (pathname.endsWith("/history")) return "history";
    if (pathname.endsWith("/studio")) return "studio";
    return "/";
}
