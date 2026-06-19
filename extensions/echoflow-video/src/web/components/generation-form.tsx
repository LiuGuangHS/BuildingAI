import { uploadFileAuto, type UploadFileResult } from "@buildingai/services/shared";
import { createRequestId } from "@buildingai/http";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { AlertCircle, ImageIcon, Info, Link, Loader2, Plus, Sparkles, Trash2, Upload, Video } from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useWebEstimateVideoBillingMutation, useWebOptimizePromptMutation, useWebPromptOptimizerOptionsQuery } from "../services";
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
    promptTemplates?: { label: string; prompt: string }[];
    initialValues?: Partial<CreateVideoParams>;
    onSubmit: (data: CreateVideoParams) => Promise<void> | void;
}

const DEFAULT_TEMPLATES = [
    { label: "自然风光", prompt: "Sunrise over a calm ocean, waves gently lapping the shore, cinematic lighting, 4k" },
    { label: "城市夜景", prompt: "A futuristic city at night with neon lights and flying cars, cyberpunk style, 4k" },
    { label: "动物世界", prompt: "A majestic lion walking through the savanna at golden hour, documentary style, 4k" },
    { label: "美食制作", prompt: "Close-up shot of a chef cooking pasta in a professional kitchen, shallow depth of field, 4k" },
];

export function GenerationForm({ loading, models, modelsLoading, disabledReason, promptTemplates, initialValues, onSubmit }: GenerationFormProps) {
    const templates = promptTemplates?.length ? promptTemplates : DEFAULT_TEMPLATES;
    const [prompt, setPrompt] = useState("");
    const [originalPrompt, setOriginalPrompt] = useState<string>();
    const [promptOptimizationSource, setPromptOptimizationSource] = useState<"ai" | "local">();
    const [promptOptimizerModelId, setPromptOptimizerModelId] = useState<string>();
    const [modelId, setModelId] = useState("");
    const [media, setMedia] = useState<VideoMediaItem[]>([]);
    const [resolution, setResolution] = useState("720P");
    const [duration, setDuration] = useState("5");
    const [ratio, setRatio] = useState("16:9");
    const [watermark, setWatermark] = useState(true);
    const [promptStyle, setPromptStyle] = useState<PromptOptimizationStyle>("cinematic");
    const [optimizerModelId, setOptimizerModelId] = useState("");
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string>();
    const fileInputsRef = useRef<Array<HTMLInputElement | null>>([]);
    const estimateMutation = useWebEstimateVideoBillingMutation();
    const { data: optimizerOptions } = useWebPromptOptimizerOptionsQuery();
    const optimizePromptMutation = useWebOptimizePromptMutation({
        onSuccess: (result) => {
            setOriginalPrompt(result.originalPrompt);
            setPromptOptimizationSource(result.source);
            setPromptOptimizerModelId(result.modelId);
            setPrompt(result.optimizedPrompt);
            if (result.source === "ai") {
                toast.success(
                    result.consumedPower
                        ? `提示词已优化，消耗 ${result.consumedPower} 算力`
                        : "提示词已优化",
                );
            } else {
                toast.success(result.warning || "已使用本地规则优化提示词");
            }
        },
        onError: (error) => {
            toast.error(error.message || "提示词优化失败");
        },
    });

    const selectedModel = models.find((m) => m.id === modelId);
    const mediaTypes = selectedModel?.mediaTypes ?? [];
    const mediaIssue = getMediaIssue(selectedModel, media);
    const resolutions = selectedModel?.capabilities?.resolutions?.length ? selectedModel.capabilities.resolutions : ["720P", "1080P"];
    const ratios = selectedModel?.capabilities?.ratios?.length ? selectedModel.capabilities.ratios : ["16:9", "9:16", "1:1"];
    const durationMin = selectedModel?.capabilities?.duration?.min ?? 1;
    const durationMax = selectedModel?.capabilities?.duration?.max ?? 30;
    const supportsRatio = ratios.length > 0;
    const fallbackEstimatedPower = estimatePower(selectedModel, resolution, Number(duration) || 5);
    const estimatedPower = estimateMutation.data?.amount ?? fallbackEstimatedPower;

    useEffect(() => {
        if (!initialValues) return;
        if (initialValues.prompt) setPrompt(initialValues.prompt);
        if (initialValues.originalPrompt) setOriginalPrompt(initialValues.originalPrompt);
        if (initialValues.promptOptimizationSource) setPromptOptimizationSource(initialValues.promptOptimizationSource);
        if (initialValues.promptOptimizerModelId) setPromptOptimizerModelId(initialValues.promptOptimizerModelId);
        if (initialValues.model) setModelId(initialValues.model);
        if (initialValues.media) setMedia(initialValues.media);
        if (initialValues.resolution) setResolution(initialValues.resolution);
        if (initialValues.duration) setDuration(String(initialValues.duration));
        if (initialValues.ratio) setRatio(initialValues.ratio);
        if (typeof initialValues.watermark === "boolean") setWatermark(initialValues.watermark);
        if (initialValues.promptOptimizationStyle) setPromptStyle(initialValues.promptOptimizationStyle as PromptOptimizationStyle);
    }, [initialValues]);

    useEffect(() => {
        if (!optimizerOptions?.models?.length) {
            setOptimizerModelId("");
            return;
        }
        const defaultModelId = optimizerOptions.defaultModelId || optimizerOptions.models[0]?.id || "";
        setOptimizerModelId((current) =>
            current && optimizerOptions.models.some((model) => model.id === current)
                ? current
                : defaultModelId,
        );
    }, [optimizerOptions?.defaultModelId, optimizerOptions?.models]);

    useEffect(() => {
        if (!selectedModel) return;
        const durationValue = Number(duration) || selectedModel.defaultParams?.duration || 5;
        estimateMutation.mutate({
            modelConfigId: selectedModel.modelConfigId,
            model: selectedModel.model,
            duration: durationValue,
            resolution,
        });
    }, [duration, resolution, selectedModel?.id]);

    const handleAddMedia = () => {
        if (mediaTypes.length === 0) return;
        const defaultType = mediaTypes[0] as VideoMediaItem["type"];
        setMedia([...media, { type: defaultType, url: "" }]);
    };

    const handleMediaTypeChange = (index: number, value: string) => {
        const updated = media.map((item, itemIndex) =>
            itemIndex === index ? { type: value as VideoMediaItem["type"], url: "" } : item,
        );
        setMedia(updated);
    };

    const handleMediaUploaded = (index: number, result: UploadFileResult, file: File) => {
        const updated = media.map((item, itemIndex) =>
            itemIndex === index
                ? { ...item, url: result.url, fileId: result.id, mimeType: result.mimeType, fileName: file.name, size: file.size }
                : item,
        );
        setMedia(updated);
    };

    const handleFileChange = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const acceptError = getUploadAcceptIssue(media[index]?.type, file);
        if (acceptError) {
            setUploadError(acceptError);
            return;
        }

        setUploadError(undefined);
        setUploadingIndex(index);
        try {
            const result = await uploadFileAuto(file, {
                description: "Echoflow Video media asset",
                extensionId: "echoflow-video",
            });
            handleMediaUploaded(index, result, file);
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : "素材上传失败，请稍后重试");
        } finally {
            setUploadingIndex(null);
        }
    };

    const handleRemoveMedia = (index: number) => {
        setMedia(media.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!prompt.trim() || !modelId || mediaIssue || uploadingIndex !== null) return;

        const params: CreateVideoParams = {
            prompt: prompt.trim(),
            originalPrompt,
            promptOptimizationSource,
            promptOptimizationStyle: promptOptimizationSource ? promptStyle : undefined,
            promptOptimizerModelId,
            model: modelId,
            requestKey: createRequestId(),
            resolution,
            duration: Number(duration) || 5,
            ratio: supportsRatio ? ratio : undefined,
            watermark,
        };

        const submittedMedia = media.filter((item) => item.fileId && item.url.trim());
        if (submittedMedia.length > 0) {
            params.media = submittedMedia;
        }

        onSubmit(params);
    };

    const handleOptimizePrompt = async () => {
        if (!prompt.trim()) {
            toast.error("请先输入提示词");
            return;
        }
        await optimizePromptMutation.mutateAsync({
            prompt: prompt.trim(),
            model: selectedModel?.model ?? modelId,
            style: promptStyle,
            modelId: optimizerModelId || undefined,
            requestKey: `prompt-opt-${createRequestId()}`,
            ratio: supportsRatio ? ratio : undefined,
            resolution,
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Video className="size-5 text-primary" />
                                视频生成
                            </CardTitle>
                            <CardDescription className="mt-1">选择模型、补齐素材，提交后自动轮询结果</CardDescription>
                        </div>
                        <Badge variant="secondary" className="w-fit">预计 {estimatedPower} 算力</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    {disabledReason && (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>服务暂不可用</AlertTitle>
                            <AlertDescription>{disabledReason}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label>模型</Label>
                        <Select
                            value={modelId}
                            onValueChange={(value) => {
                                setModelId(value);
                                setMedia([]);
                                const nextModel = models.find((model) => model.id === value);
                                const defaults = nextModel?.defaultParams;
                                if (defaults?.resolution) setResolution(defaults.resolution);
                                if (defaults?.duration) setDuration(String(defaults.duration));
                                if (defaults?.ratio) setRatio(defaults.ratio);
                                if (typeof defaults?.watermark === "boolean") setWatermark(defaults.watermark);
                            }}
                            disabled={modelsLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择模型..." />
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">{model.name}</span>
                                            <span className="text-muted-foreground text-xs">{model.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedModel && (
                            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                                <Info className="mt-0.5 size-3.5 shrink-0" />
                                {selectedModel.description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Label>提示词</Label>
                            <div className="flex flex-wrap gap-2">
                                {optimizerOptions?.models?.length ? (
                                    <Select value={optimizerModelId} onValueChange={setOptimizerModelId}>
                                        <SelectTrigger className="h-8 w-[180px]">
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
                                <Select value={promptStyle} onValueChange={(value) => setPromptStyle(value as PromptOptimizationStyle)}>
                                    <SelectTrigger className="h-8 w-[112px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cinematic">电影感</SelectItem>
                                        <SelectItem value="commercial">商业</SelectItem>
                                        <SelectItem value="realistic">写实</SelectItem>
                                        <SelectItem value="anime">动漫</SelectItem>
                                        <SelectItem value="minimal">简洁</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!prompt.trim() || optimizePromptMutation.isPending}
                                    onClick={() => {
                                        void handleOptimizePrompt();
                                    }}
                                >
                                    {optimizePromptMutation.isPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="size-3.5" />
                                    )}
                                    优化
                                </Button>
                            </div>
                        </div>
                        <Textarea
                            placeholder="描述你想要生成的视频内容..."
                            rows={3}
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {templates.map((template) => (
                                <Button
                                    key={template.label}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPrompt(template.prompt)}
                                >
                                    {template.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {mediaTypes.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>媒体素材</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddMedia}>
                                    <Plus className="size-3.5" />
                                    添加
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {media.map((item, index) => (
                                    <div key={index} className="rounded-lg border p-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start">
                                            <Select value={item.type} onValueChange={(value) => handleMediaTypeChange(index, value)}>
                                                <SelectTrigger className="md:w-24 shrink-0">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mediaTypes.map((mediaType) => (
                                                        <SelectItem key={mediaType} value={mediaType}>
                                                            {typeLabel(mediaType)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex min-h-10 flex-1 items-center rounded-md border bg-muted/30 px-3 text-sm">
                                                {item.fileId ? (
                                                    <span className="truncate">{item.fileName || item.url}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">请上传{typeLabel(item.type)}素材</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Input
                                                    ref={(node) => {
                                                        fileInputsRef.current[index] = node;
                                                    }}
                                                    type="file"
                                                    className="hidden"
                                                    accept={getUploadAccept(item.type)}
                                                    onChange={(event) => {
                                                        void handleFileChange(index, event);
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    disabled={uploadingIndex !== null}
                                                    onClick={() => fileInputsRef.current[index]?.click()}
                                                >
                                                    {uploadingIndex === index ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : (
                                                        <Upload className="size-4" />
                                                    )}
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMedia(index)}>
                                                    <Trash2 className="size-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </div>
                                        <MediaPreview item={item} />
                                    </div>
                                ))}
                            </div>
                            {media.length === 0 && (
                                <p className="text-muted-foreground text-xs">点击"添加"后上传素材，系统会使用平台上传记录校验文件归属。</p>
                            )}
                            {uploadError && <p className="text-destructive text-xs">{uploadError}</p>}
                            {mediaIssue && <p className="text-destructive text-xs">{mediaIssue}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>生成参数</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">分辨率</Label>
                                <Select value={resolution} onValueChange={setResolution}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {resolutions.map((item) => (
                                            <SelectItem key={item} value={item}>{item}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">时长 (秒)</Label>
                                <Input
                                    type="number"
                                    min={durationMin}
                                    max={durationMax}
                                    value={duration}
                                    onChange={(event) => setDuration(event.target.value)}
                                />
                            </div>
                            {supportsRatio && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">比例</Label>
                                    <Select value={ratio} onValueChange={setRatio}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {ratios.map((item) => (
                                                <SelectItem key={item} value={item}>{item}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-1.5 flex items-end">
                                <div className="flex items-center gap-2">
                                    <Switch checked={watermark} onCheckedChange={setWatermark} id="watermark" />
                                    <Label htmlFor="watermark" className="text-xs text-muted-foreground cursor-pointer">
                                        水印
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={Boolean(disabledReason) || loading || uploadingIndex !== null || !prompt.trim() || !modelId || !!mediaIssue}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                提交中...
                            </>
                        ) : (
                            <>
                                <Video className="size-4" />
                                生成视频
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </form>
    );
}

function MediaPreview({ item }: { item: VideoMediaItem }) {
    if (!item.url.trim()) return null;

    return (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-muted/50 p-2">
            <div className="size-14 overflow-hidden rounded bg-background flex items-center justify-center shrink-0">
                {item.type === "video" ? (
                    <video src={item.url} className="size-full object-cover" muted />
                ) : (
                    <img src={item.url} alt="" className="size-full object-cover" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-medium">
                    {item.type === "video" ? <Video className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    {item.fileId ? "已上传素材" : "待重新上传素材"}
                </p>
                <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                    <Link className="size-3 shrink-0" />
                    {item.url}
                </p>
                {item.mimeType && <p className="text-muted-foreground text-xs">{item.mimeType}</p>}
            </div>
        </div>
    );
}

function typeLabel(type: string) {
    switch (type) {
        case "first_frame":
            return "首帧";
        case "reference_image":
            return "参考图";
        case "video":
            return "视频";
        default:
            return type;
    }
}

function getMediaIssue(model: VideoModelOption | undefined, media: VideoMediaItem[]) {
    if (!model) return undefined;
    const firstFrames = media.filter((item) => item.type === "first_frame" && item.url.trim());
    const references = media.filter((item) => item.type === "reference_image" && item.url.trim());
    const videos = media.filter((item) => item.type === "video" && item.url.trim());
    const abilityTypes = model.capabilities?.abilityTypes ?? [];

    if (model.mediaTypes.length === 0 && media.some((item) => item.url.trim())) {
        return "该模型不需要媒体素材";
    }
    if (media.some((item) => item.url.trim() && !item.fileId)) {
        return "历史外链素材需要重新上传后才能提交";
    }
    if (firstFrames.length > 0) {
        if (!abilityTypes.includes("first_frame_i2v")) return "当前模型不支持首帧图生视频";
        if (firstFrames.length !== 1 || references.length > 0 || videos.length > 0) return "图生视频需要且只需要 1 张首帧图片";
    }
    if (references.length > 0) {
        if (!abilityTypes.includes("reference_to_video") && !abilityTypes.includes("video_editing")) return "当前模型不支持参考图素材";
        if (references.length > 4) return "参考图最多 4 张";
    }
    if (videos.length > 0) {
        if (!abilityTypes.includes("video_editing") && !abilityTypes.includes("action_transfer")) return "当前模型不支持视频编辑";
        if (videos.length !== 1 || firstFrames.length > 0) return "视频编辑需要 1 个视频，可再添加参考图";
    }
    if (!media.some((item) => item.url.trim()) && !abilityTypes.includes("text_to_video")) {
        if (abilityTypes.includes("first_frame_i2v")) return "图生视频需要 1 张首帧图片";
        if (abilityTypes.includes("reference_to_video")) return "参考图生视频需要 1-4 张参考图";
        if (abilityTypes.includes("video_editing") || abilityTypes.includes("action_transfer")) return "视频编辑需要 1 个视频";
    }
    return undefined;
}

function getUploadAccept(type: VideoMediaItem["type"]) {
    return type === "video" ? "video/*" : "image/*";
}

function getUploadAcceptIssue(type: VideoMediaItem["type"] | undefined, file: File) {
    if (!type) return "请先选择素材类型";
    if (type === "video") {
        if (!file.type.startsWith("video/")) return "视频素材只能上传视频文件";
        if (file.size > 300 * 1024 * 1024) return "视频文件不能超过 300MB";
        return undefined;
    }
    if (!file.type.startsWith("image/")) return "图片素材只能上传图片文件";
    if (file.size > 20 * 1024 * 1024) return "图片文件不能超过 20MB";
    return undefined;
}

function estimatePower(model: VideoModelOption | undefined, resolution: string, duration: number) {
    const modelMultiplier: Record<string, number> = {
        "doubao-seedance-2-0-260128": 4,
        "doubao-seedance-1-5-pro-251215": 3,
        "kling-text2video": 3,
        "kling-image2video": 3,
        "kling-multi-image2video": 4,
        "happyhorse-1.0-t2v": 2,
        "happyhorse-1.0-i2v": 3,
        "happyhorse-1.0-r2v": 3,
        "happyhorse-1.0-video-edit": 4,
    };
    const min = model?.capabilities?.duration?.min ?? 1;
    const max = model?.capabilities?.duration?.max ?? 30;
    const safeDuration = Math.min(Math.max(duration || 5, min), max);
    return Math.ceil(safeDuration * (modelMultiplier[model?.model ?? ""] ?? 2) * (resolution === "1080P" ? 2 : 1));
}
