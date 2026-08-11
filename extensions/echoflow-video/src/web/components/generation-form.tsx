import { uploadFileAuto, type UploadFileResult } from "@buildingai/services/shared";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import {
    AlertCircle,
    CheckCircle2,
    Clapperboard,
    Film,
    ImageIcon,
    Info,
    Loader2,
    ShieldCheck,
    Sparkles,
    Upload,
    Video,
    WandSparkles,
    X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
    getBillingLabel,
    getMediaTypeLabel,
    getPromptSourceLabel,
    promptStyleLabel,
} from "../lib/video-labels";
import {
    type MaterialSlot,
    type VideoGenerationMode,
    getCompatibleModels,
    getDefaultMode,
    getMaterialSlots,
    getMediaIssueForMode,
    getModeDefinition,
    getModeOptions,
    inferModeFromMedia,
    modelSupportsMode,
    sanitizeMediaForMode,
} from "../lib/video-mode";
import { useWebEstimateVideoBillingMutation, useWebOptimizePromptMutation, useWebPromptOptimizerOptionsQuery } from "../services/web";
import type {
    CreateVideoParams,
    PromptOptimizationStyle,
    VideoMediaItem,
    VideoModelOption,
} from "../services/types/generation";

interface GenerationFormProps {
    loading?: boolean;
    models: VideoModelOption[];
    modelsLoading?: boolean;
    disabledReason?: string;
    promptTemplates?: {
        label: string;
        prompt: string;
        modelConfigId?: string;
        defaultParams?: {
            duration?: number;
            resolution?: string;
            ratio?: string;
            watermark?: boolean;
        };
    }[];
    initialValues?: Partial<CreateVideoParams>;
    onSubmit: (data: CreateVideoParams) => Promise<void> | void;
}

export function GenerationForm({ loading, models, modelsLoading, disabledReason, promptTemplates, initialValues, onSubmit }: GenerationFormProps) {
    const templates = promptTemplates ?? [];
    const [mode, setMode] = useState<VideoGenerationMode>("text");
    const [prompt, setPrompt] = useState("");
    const [originalPrompt, setOriginalPrompt] = useState<string>();
    const [promptOptimizationSource, setPromptOptimizationSource] = useState<"ai" | "local">();
    const [promptOptimizerModelId, setPromptOptimizerModelId] = useState<string | undefined>(undefined);
    const [modelId, setModelId] = useState("");
    const [media, setMedia] = useState<VideoMediaItem[]>([]);
    const [resolution, setResolution] = useState("720P");
    const [duration, setDuration] = useState("5");
    const [ratio, setRatio] = useState("16:9");
    const [watermark, setWatermark] = useState(true);
    const [promptStyle, setPromptStyle] = useState<PromptOptimizationStyle>("cinematic");
    const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string>();
    const [unavailableInitialModelId, setUnavailableInitialModelId] = useState<string>();
    const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
    const estimateMutation = useWebEstimateVideoBillingMutation();
    const { data: optimizerOptions } = useWebPromptOptimizerOptionsQuery();
    const modeOptions = useMemo(() => getModeOptions(models), [models]);
    const compatibleModels = useMemo(() => getCompatibleModels(mode, models), [mode, models]);
    const selectedModel = compatibleModels.find((item) => item.id === modelId) ?? compatibleModels[0];
    const materialSlots = useMemo(() => getMaterialSlots(mode, selectedModel), [mode, selectedModel]);
    const mediaIssue = getMediaIssueForMode(mode, selectedModel, media);
    const resolutions = selectedModel?.capabilities?.resolutions?.length ? selectedModel.capabilities.resolutions : ["720P", "1080P"];
    const ratios = selectedModel?.capabilities?.ratios?.length ? selectedModel.capabilities.ratios : ["16:9", "9:16", "1:1"];
    const durationMin = selectedModel?.capabilities?.duration?.min ?? 1;
    const durationMax = selectedModel?.capabilities?.duration?.max ?? 30;
    const supportsRatio = ratios.length > 0;
    const estimatedPower = estimateMutation.data?.amount;
    const billingEstimateLabel = getBillingEstimateLabel({
        amount: estimatedPower,
        isPending: estimateMutation.isPending,
        isError: estimateMutation.isError,
    });
    const canSubmit = !disabledReason
        && !loading
        && uploadingSlotId === null
        && Boolean(prompt.trim())
        && Boolean(selectedModel)
        && !mediaIssue
        && !unavailableInitialModelId;
    const controlsDisabled = Boolean(disabledReason) || Boolean(loading) || !selectedModel;
    const modeControlsDisabled = Boolean(disabledReason) || Boolean(loading);
    const modeHasNoCompatibleModels = models.length > 0 && compatibleModels.length === 0;
    const optimizerEnabled = optimizerOptions?.enabled !== false && Boolean(optimizerOptions?.models?.length);

    const optimizePromptMutation = useWebOptimizePromptMutation({
        onSuccess: (result) => {
            setOriginalPrompt(result.originalPrompt);
            setPromptOptimizationSource(result.source);
            setPromptOptimizerModelId(result.modelId);
            setPrompt(result.optimizedPrompt);
            toast.success(result.source === "ai" && result.consumedPower
                ? `提示词已优化，消耗 ${result.consumedPower} 算力`
                : result.warning || "提示词已优化");
        },
        onError: (error) => {
            toast.error(error.message || "提示词优化失败");
        },
    });

    useEffect(() => {
        if (!models.length) return;
        setMode((current) => getDefaultMode(models, current));
    }, [models]);

    useEffect(() => {
        if (!selectedModel) {
            setModelId("");
            return;
        }
        if (selectedModel.id !== modelId) {
            setModelId(selectedModel.id);
            applyModelDefaults(selectedModel);
        }
    }, [selectedModel?.id]);

    useEffect(() => {
        setMedia((current) => sanitizeMediaForMode(mode, current));
        setUploadError(undefined);
    }, [mode]);

    useEffect(() => {
        if (!initialValues) return;
        const initialModel = models.find((item) => item.modelConfigId === initialValues.modelConfigId);
        const initialMode = inferModeFromMedia(initialValues.media, initialModel);
        setUnavailableInitialModelId(initialValues.modelConfigId && !initialModel ? initialValues.modelConfigId : undefined);
        setUnavailableInitialModelId(initialValues.modelConfigId && !initialModel ? initialValues.modelConfigId : undefined);
        setMode(getDefaultMode(models, initialMode));
        if (initialValues.prompt) setPrompt(initialValues.prompt);
        if (initialValues.originalPrompt) setOriginalPrompt(initialValues.originalPrompt);
        if (initialValues.promptOptimizationSource) setPromptOptimizationSource(initialValues.promptOptimizationSource);
        if (initialValues.promptOptimizerModelId) setPromptOptimizerModelId(initialValues.promptOptimizerModelId);
        if (initialValues.modelConfigId && (!initialModel || modelSupportsMode(initialModel, initialMode))) setModelId(initialValues.modelConfigId);
        if (initialValues.media) setMedia(sanitizeMediaForMode(initialMode, initialValues.media));
        if (initialValues.resolution) setResolution(initialValues.resolution);
        if (initialValues.duration) setDuration(String(initialValues.duration));
        if (initialValues.ratio) setRatio(initialValues.ratio);
        if (typeof initialValues.watermark === "boolean") setWatermark(initialValues.watermark);
        if (initialValues.promptOptimizationStyle) setPromptStyle(initialValues.promptOptimizationStyle as PromptOptimizationStyle);
    }, [initialValues, models]);

    useEffect(() => {
        if (!optimizerOptions?.models?.length) {
            setPromptOptimizerModelId(undefined);
            return;
        }
        const defaultModelId = optimizerOptions.defaultModelId || optimizerOptions.models[0]?.id || undefined;
        setPromptOptimizerModelId((current) =>
            current && optimizerOptions.models.some((model) => model.id === current)
                ? current
                : defaultModelId,
        );
    }, [optimizerOptions?.defaultModelId, optimizerOptions?.models]);

    useEffect(() => {
        if (!selectedModel) return;
        if (!selectedModel.modelConfigId || !selectedModel.model) return;
        const durationValue = Number(duration) || selectedModel.defaultParams?.duration || 5;
        estimateMutation.mutate({
            modelConfigId: selectedModel.modelConfigId,
            model: selectedModel.model,
            duration: durationValue,
            resolution,
        });
    }, [duration, resolution, selectedModel?.id]);

    const applyModelDefaults = (model: VideoModelOption) => {
        const defaults = model.defaultParams;
        if (defaults?.resolution) setResolution(defaults.resolution);
        if (defaults?.duration) setDuration(String(defaults.duration));
        if (defaults?.ratio) setRatio(defaults.ratio);
        if (typeof defaults?.watermark === "boolean") setWatermark(defaults.watermark);
    };

    const handleModeChange = (nextMode: VideoGenerationMode) => {
        const option = modeOptions.find((item) => item.id === nextMode);
        if (!option?.available) return;
        setMode(nextMode);
        const nextModels = getCompatibleModels(nextMode, models);
        const currentModel = models.find((item) => item.id === modelId);
        if (!currentModel || !modelSupportsMode(currentModel, nextMode)) {
            const nextModel = nextModels[0];
            setModelId(nextModel?.id ?? "");
            if (nextModel) applyModelDefaults(nextModel);
        }
    };

    const upsertMediaForSlot = (slot: MaterialSlot, item: VideoMediaItem | undefined) => {
        setMedia((current) => {
            const next = [...current];
            const slotIndex = materialSlots.findIndex((materialSlot) => materialSlot.id === slot.id);
            const sameTypeMediaIndexes = next
                .map((mediaItem, index) => ({ mediaItem, index }))
                .filter(({ mediaItem }) => mediaItem.type === slot.type)
                .map(({ index }) => index);
            const existingIndex = sameTypeMediaIndexes[slot.type === "reference_image" ? slotIndexForReference(slotIndex, materialSlots) : 0];

            if (!item) {
                if (existingIndex != null) next.splice(existingIndex, 1);
                return sanitizeMediaForMode(mode, next);
            }

            if (existingIndex == null) {
                return sanitizeMediaForMode(mode, [...next, item]);
            }
            next[existingIndex] = item;
            return sanitizeMediaForMode(mode, next);
        });
    };

    const handleMediaUploaded = (slot: MaterialSlot, result: UploadFileResult, file: File) => {
        upsertMediaForSlot(slot, {
            type: slot.type,
            url: result.url,
            fileId: result.id,
            mimeType: result.mimeType,
            fileName: file.name,
            size: file.size,
        });
    };

    const handleFileChange = async (slot: MaterialSlot, event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const acceptError = getUploadAcceptIssue(slot.type, file);
        if (acceptError) {
            setUploadError(acceptError);
            return;
        }

        setUploadError(undefined);
        setUploadingSlotId(slot.id);
        try {
            const result = await uploadFileAuto(file, {
                description: "Echoflow Video media asset",
                extensionId: "echoflow-video",
            });
            handleMediaUploaded(slot, result, file);
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : "素材上传失败，请稍后重试");
        } finally {
            setUploadingSlotId(null);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit || !selectedModel) return;

        const params: CreateVideoParams = {
            prompt: prompt.trim(),
            originalPrompt,
            promptOptimizationSource,
            promptOptimizationStyle: promptOptimizationSource ? promptStyle : undefined,
            promptOptimizerModelId: promptOptimizationSource ? promptOptimizerModelId : undefined,
            modelConfigId: selectedModel.modelConfigId ?? selectedModel.id,
            resolution,
            duration: Number(duration) || 5,
            ratio: supportsRatio ? ratio : undefined,
            watermark,
        };

        const submittedMedia = sanitizeMediaForMode(mode, media).filter((item) => item.fileId && item.url.trim());
        if (submittedMedia.length > 0) {
            params.media = submittedMedia;
        }

        onSubmit(params);
    };

    const applyTemplate = (template: (typeof templates)[number]) => {
        setPrompt(template.prompt);
        setOriginalPrompt(undefined);
        setPromptOptimizationSource(undefined);
        const nextModel = template.modelConfigId
            ? models.find((model) => model.modelConfigId === template.modelConfigId)
            : undefined;
        if (nextModel && modelSupportsMode(nextModel, mode)) {
            setModelId(nextModel.id);
            applyModelDefaults(nextModel);
        }
        const defaults = template.defaultParams;
        if (defaults?.resolution) setResolution(defaults.resolution);
        if (defaults?.duration) setDuration(String(defaults.duration));
        if (defaults?.ratio) setRatio(defaults.ratio);
        if (typeof defaults?.watermark === "boolean") setWatermark(defaults.watermark);
    };

    const handleOptimizePrompt = async () => {
        if (!optimizerEnabled) {
            toast.error("提示词优化暂不可用");
            return;
        }
        if (!prompt.trim()) {
            toast.error("请先输入提示词");
            return;
        }
        await optimizePromptMutation.mutateAsync({
            prompt: prompt.trim(),
            model: selectedModel?.model,
            style: promptStyle,
            modelId: promptOptimizerModelId,
            ratio: supportsRatio ? ratio : undefined,
            resolution,
        });
    };

    const selectedMode = getModeDefinition(mode);

    return (
        <Card className="overflow-hidden">
            <form onSubmit={handleSubmit}>
                <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <WandSparkles className="size-5 text-primary" />
                            创建视频任务
                        </CardTitle>
                        <CardDescription className="mt-1">
                            视频生成需要一些时间，提交后会进入队列处理。
                        </CardDescription>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[auto_auto]">
                        <Badge variant="secondary" className="justify-center gap-1.5 sm:justify-start">
                            <Sparkles className="size-3.5" />
                            {billingEstimateLabel.compact}
                        </Badge>
                        <Button type="submit" variant={disabledReason ? "secondary" : "default"} disabled={!canSubmit} className="w-full sm:w-auto">
                            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            {loading ? "提交中" : disabledReason ? "暂未开放" : "提交生成任务"}
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-5">
                    {disabledReason && (
                        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            <p>{disabledReason} 可到 Console 开启可用模型后再试。</p>
                        </div>
                    )}
                    {unavailableInitialModelId && (
                        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            <p>原任务模型已不可用，请主动选择一个新模型后再提交。</p>
                        </div>
                    )}

                <section className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-medium">生成方式</p>
                            <p className="text-xs text-muted-foreground">{selectedMode.description}</p>
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {modeOptions.map((option) => (
                            <Button
                                key={option.id}
                                type="button"
                                variant={mode === option.id ? "default" : "outline"}
                                disabled={modeControlsDisabled || !option.available || modelsLoading}
                                className="h-auto justify-start gap-2 px-3 py-2 text-left"
                                onClick={() => handleModeChange(option.id)}
                            >
                                <Film className="size-4 shrink-0" />
                                <span className="truncate">{option.label}</span>
                            </Button>
                        ))}
                    </div>
                </section>

                <section className="space-y-2">
                    <p className="text-sm font-medium">生成规格</p>
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Clapperboard className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{selectedModel?.name || "暂未开放"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                                {selectedModel?.description || "当前还没有可用的视频生成规格。"}
                            </p>
                        </div>
                        <Select
                            value={selectedModel?.id ?? ""}
                            onValueChange={(value) => {
                                setModelId(value);
                                setUnavailableInitialModelId(undefined);
                                const nextModel = models.find((model) => model.id === value);
                                if (nextModel) applyModelDefaults(nextModel);
                                setMedia((current) => sanitizeMediaForMode(mode, current));
                            }}
                            disabled={controlsDisabled || modelsLoading || compatibleModels.length === 0}
                        >
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="选择模型" />
                            </SelectTrigger>
                            <SelectContent>
                                {compatibleModels.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedModel ? (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Info className="mt-0.5 size-3.5 shrink-0" />
                            {selectedModel.description}
                        </p>
                    ) : null}
                    {modeHasNoCompatibleModels ? (
                        <Alert>
                            <AlertCircle className="size-4" />
                            <AlertTitle>当前模式暂无可用模型</AlertTitle>
                            <AlertDescription>
                                请在 Console 启用支持该生成方式的视频模型；用户端会继续保留工作台，但暂时不能提交该模式任务。
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </section>

                <section className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">画面描述</p>
                        <div className="flex flex-wrap gap-2">
                            {optimizerOptions?.models?.length ? (
                                <Select value={promptOptimizerModelId ?? ""} onValueChange={(v) => setPromptOptimizerModelId(v || undefined)} disabled={controlsDisabled}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="优化模型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {optimizerOptions.models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : null}
                            <Select value={promptStyle} onValueChange={(value) => setPromptStyle(value as PromptOptimizationStyle)} disabled={controlsDisabled}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(promptStyleLabel).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={controlsDisabled || !optimizerEnabled || !prompt.trim() || optimizePromptMutation.isPending}
                                onClick={() => {
                                    void handleOptimizePrompt();
                                }}
                            >
                                {optimizePromptMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Sparkles className="size-4" />
                                )}
                                优化描述
                            </Button>
                        </div>
                    </div>
                    {optimizerOptions?.billingEnabled ? (
                        <p className="text-xs text-muted-foreground">AI 优化提示词可能单独消耗算力；本地优化不扣费。</p>
                    ) : null}
                    <Textarea
                        className="min-h-32 resize-y leading-7"
                        placeholder="描述主体、镜头、动作、风格和画面节奏，例如：清晨咖啡店里，手持镜头缓慢推近正在冒热气的拿铁..."
                        rows={5}
                        value={prompt}
                        disabled={controlsDisabled}
                        onChange={(event) => setPrompt(event.target.value)}
                    />
                        <div className="flex flex-wrap gap-2">
                            {templates.map((template) => (
                                <Button
                                    key={template.label}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={controlsDisabled}
                                    onClick={() => applyTemplate(template)}
                                >
                                    {template.label}
                                </Button>
                            ))}
                        </div>
                    {promptOptimizationSource && originalPrompt && (
                        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">原始描述</p>
                                <p className="mt-1 leading-6">{originalPrompt}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">{getPromptSourceLabel(promptOptimizationSource)} · {promptStyleLabel[promptStyle]}</p>
                                <p className="mt-1 leading-6">{prompt}</p>
                            </div>
                        </div>
                    )}
                </section>

                <section className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">参考素材</p>
                        <p className="text-xs text-muted-foreground">{mode === "text" ? "该模式无需上传素材" : "素材会通过平台上传校验"}</p>
                    </div>
                    {materialSlots.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                            <Clapperboard className="size-4" />
                            <span>文生视频只需要提示词和生成参数。</span>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {materialSlots.map((slot, index) => {
                                const item = getMediaForSlot(slot, index, materialSlots, media);
                                const isUploading = uploadingSlotId === slot.id;
                                return (
                                    <div key={slot.id} className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                                <Badge variant={slot.required ? "default" : "secondary"}>{slot.required ? "必需" : "可选"}</Badge>
                                                {item?.url ? (
                                                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => upsertMediaForSlot(slot, undefined)} aria-label="移除素材">
                                                        <X className="size-4" />
                                                    </Button>
                                                ) : null}
                                        </div>
                                        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-background">
                                            {item?.url ? (
                                                slot.type === "video" ? (
                                                    <video src={item.url} className="size-full object-cover" muted />
                                                ) : (
                                                    <img src={item.url} alt="" className="size-full object-cover" />
                                                )
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
                                                    {slot.type === "video" ? <Video className="size-6" /> : <ImageIcon className="size-6" />}
                                                    <span>{slot.label}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{item?.fileName || slot.label}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {item?.fileId ? "已上传并记录 fileId" : item?.url ? "需重新上传后提交" : getMediaTypeLabel(slot.type)}
                                            </p>
                                        </div>
                                        <Input
                                            ref={(node) => {
                                                fileInputsRef.current[slot.id] = node;
                                            }}
                                            type="file"
                                            className="hidden"
                                            accept={slot.accept}
                                            onChange={(event) => {
                                                void handleFileChange(slot, event);
                                            }}
                                        />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={controlsDisabled || uploadingSlotId !== null}
                                                onClick={() => fileInputsRef.current[slot.id]?.click()}
                                            >
                                                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                                {item?.url ? "替换" : "上传"}
                                            </Button>
                                        </div>
                                );
                            })}
                        </div>
                    )}
                    {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                    {mediaIssue && <p className="text-xs text-destructive">{mediaIssue}</p>}
                </section>

                <section className="space-y-2">
                    <p className="text-sm font-medium">生成设置</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1.5">
                                <Label>时长</Label>
                                <Input
                                    type="number"
                                    min={durationMin}
                                max={durationMax}
                                value={duration}
                                    disabled={controlsDisabled}
                                    onChange={(event) => setDuration(event.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>分辨率</Label>
                                <Select value={resolution} onValueChange={setResolution} disabled={controlsDisabled}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                    {resolutions.map((item) => (
                                        <SelectItem key={item} value={item}>{item}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {supportsRatio && (
                                <div className="space-y-1.5">
                                    <Label>比例</Label>
                                    <Select value={ratio} onValueChange={setRatio} disabled={controlsDisabled}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                        {ratios.map((item) => (
                                            <SelectItem key={item} value={item}>{item}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label>水印</Label>
                                <div className="flex min-h-10 items-center gap-2 rounded-md border px-3">
                                    <Switch checked={watermark} onCheckedChange={setWatermark} id="watermark" disabled={controlsDisabled} />
                                    <span className="text-sm text-muted-foreground">{watermark ? "开启" : "关闭"}</span>
                                </div>
                            </div>
                        </div>
                </section>

                    <section className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                        <div>
                            <span className="text-xs text-muted-foreground">预计消耗</span>
                            <p className="mt-1 font-medium">{billingEstimateLabel.detail}</p>
                            {billingEstimateLabel.description ? (
                                <p className="mt-1 text-xs text-muted-foreground">{billingEstimateLabel.description}</p>
                            ) : null}
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">失败退款</span>
                            <p className="mt-1 flex items-center gap-1.5 font-medium"><ShieldCheck className="size-4" />按账务规则处理</p>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">提交后</span>
                            <p className="mt-1 font-medium">{getBillingLabel("pending")} · 排队生成</p>
                        </div>
                    </section>
                </CardContent>
            </form>
        </Card>
    );
}

function getMediaForSlot(slot: MaterialSlot, slotIndex: number, slots: MaterialSlot[], media: VideoMediaItem[]) {
    if (slot.type !== "reference_image") {
        return media.find((item) => item.type === slot.type);
    }
    const referenceIndex = slotIndexForReference(slotIndex, slots);
    return media.filter((item) => item.type === "reference_image")[referenceIndex];
}

function slotIndexForReference(slotIndex: number, slots?: MaterialSlot[]) {
    if (!slots) return slotIndex;
    return slots.slice(0, slotIndex + 1).filter((item) => item.type === "reference_image").length - 1;
}

function getUploadAcceptIssue(type: VideoMediaItem["type"], file: File) {
    if (type === "video") {
        if (!file.type.startsWith("video/")) return "视频素材只能上传视频文件";
        if (file.size > 300 * 1024 * 1024) return "视频文件不能超过 300MB";
        return undefined;
    }
    if (!file.type.startsWith("image/")) return "图片素材只能上传图片文件";
    if (file.size > 20 * 1024 * 1024) return "图片文件不能超过 20MB";
    return undefined;
}

function getBillingEstimateLabel({
    amount,
    isPending,
    isError,
}: {
    amount?: number;
    isPending: boolean;
    isError: boolean;
}) {
    if (amount != null) {
        return {
            compact: `${amount} 算力`,
            detail: `${amount} 算力`,
            description: undefined,
        };
    }
    if (isPending) {
        return {
            compact: "预估中",
            detail: "按配置预估中",
            description: "正在读取模型计费规则。",
        };
    }
    if (isError) {
        return {
            compact: "预估暂不可用",
            detail: "预估暂不可用",
            description: "提交时仍会以后端计费规则为准，失败按账务事实处理。",
        };
    }
    return {
        compact: "按配置预估",
        detail: "按配置预估",
        description: "具体消耗以后端模型计费规则为准。",
    };
}
