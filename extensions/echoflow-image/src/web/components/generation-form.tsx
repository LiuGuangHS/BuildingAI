import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { ChevronDown, ImagePlus, Plus, ShieldCheck, Sparkles, Trash2, WandSparkles, Zap } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
    ImageGenerationMode,
    ImageResponseFormat,
    type CreateGenerationParams,
    type ImageModelOption,
    type ImageSourceRecord,
} from "../services/types/generation";
import type { ImagePromptTemplate } from "../services/types/template";
import { ReferenceImageUpload } from "./reference-image-upload";

interface GenerationFormProps {
    loading?: boolean;
    models?: ImageModelOption[];
    modelsLoading?: boolean;
    initialValues?: Partial<CreateGenerationParams>;
    templates?: ImagePromptTemplate[];
    estimatedPower?: number;
    onSubmit: (data: CreateGenerationParams) => Promise<void> | void;
    onEstimateChange?: (data: CreateGenerationParams) => void;
    onEnhancePrompt?: (data: { prompt: string; modelId: string; style?: string }) => Promise<{ prompt: string; source: "ai" }>;
}

const promptTemplates = [
    { label: "雨夜街景", prompt: "未来城市雨后街道，霓虹倒影落在湿润路面，低机位构图，电影感光影，清晰细节" },
    { label: "山湖清晨", prompt: "清晨山间湖泊，薄雾、雪山倒影和自然柔光，照片级写实，画面干净" },
    { label: "枫叶庭院", prompt: "日式庭院，枫叶、石灯、木质回廊和秋日柔光，安静克制，细节丰富" },
    { label: "产品静物", prompt: "极简产品静物摄影，浅色背景，柔和工作室光，材质清晰，商业级质感" },
    { label: "机甲战场", prompt: "未来机甲站在雾气战场，金属结构清晰，低角度构图，电影感，强细节" },
    { label: "室内软装", prompt: "现代室内空间，落地窗、织物沙发、植物与自然光，温和色彩，高级家居摄影" },
];

function normalizeOptionalString(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function GenerationForm({
    loading,
    models = [],
    modelsLoading,
    initialValues,
    templates = [],
    estimatedPower,
    onSubmit,
    onEstimateChange,
    onEnhancePrompt,
}: GenerationFormProps) {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
    const [referenceImageFileId, setReferenceImageFileId] = useState<string | undefined>();
    const [additionalReferenceImages, setAdditionalReferenceImages] = useState<ImageSourceRecord[]>([]);
    const [modelId, setModelId] = useState("");
    const [size, setSize] = useState("1024x1024");
    const [n, setN] = useState("1");
    const [quality, setQuality] = useState("standard");
    const [style, setStyle] = useState("vivid");
    const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>(ImageResponseFormat.B64_JSON);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (!initialValues) return;
        setPrompt(initialValues.prompt ?? "");
        setNegativePrompt(initialValues.negativePrompt ?? "");
        setReferenceImageUrl(initialValues.referenceImageUrl);
        setReferenceImageFileId(initialValues.referenceImageFileId);
        setAdditionalReferenceImages((initialValues.sourceImages ?? []).slice(1));
        setModelId(initialValues.modelId ?? "");
        setSize(initialValues.size ?? "1024x1024");
        setN(String(initialValues.n ?? 1));
        setQuality(initialValues.quality ?? "standard");
        setStyle(initialValues.style ?? "vivid");
        setResponseFormat(initialValues.responseFormat ?? ImageResponseFormat.B64_JSON);
    }, [initialValues]);

    const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);

    useEffect(() => {
        if (modelsLoading) return;
        if (!models.length) {
            if (modelId) setModelId("");
            return;
        }
        if (!modelId || !models.some((model) => model.id === modelId)) {
            setModelId(models[0].id);
        }
    }, [models, modelsLoading, modelId]);

    const canUseImageToImage = selectedModel?.capabilities?.imageToImage === true;
    const canUseMultiReference = selectedModel?.capabilities?.multiReference === true;
    const canUseNegativePrompt = selectedModel?.capabilities?.negativePrompt !== false;
    const sizeOptions = selectedModel?.allowedParams?.sizes?.length
        ? selectedModel.allowedParams.sizes
        : ["1024x1024", "1024x1792", "1792x1024"];
    const qualityOptions = selectedModel?.allowedParams?.qualities?.length
        ? selectedModel.allowedParams.qualities
        : ["standard", "hd"];
    const styleOptions = selectedModel?.allowedParams?.styles?.length
        ? selectedModel.allowedParams.styles
        : ["vivid", "natural"];
    const isDalle3Like = selectedModel?.model?.toLowerCase().includes("dall-e-3");
    const imageCount = isDalle3Like ? 1 : Number(n || 1);
    const [width, height] = size.split("x").map((item) => Number(item));
    const localEstimatedPower = imageCount * (quality === "hd" ? 2 : 1) * (width > 1024 || height > 1024 ? 2 : 1);
    const visibleEstimatedPower = estimatedPower ?? localEstimatedPower;

    const promptRatio = prompt.length / 4000;
    const promptColor =
        promptRatio > 0.9 ? "text-red-500" : promptRatio > 0.5 ? "text-amber-500" : "text-muted-foreground";
    const hasReferenceImage = Boolean(referenceImageUrl || referenceImageFileId);
    const sourceImages = useMemo(
        () => [
            ...(hasReferenceImage ? [{ url: referenceImageUrl, fileId: referenceImageFileId }] : []),
            ...additionalReferenceImages.filter((item) => item.url || item.fileId),
        ],
        [hasReferenceImage, referenceImageUrl, referenceImageFileId, additionalReferenceImages],
    );
    const usableSourceImages = useMemo(
        () =>
            canUseImageToImage
                ? sourceImages
                    .map((item) => ({
                        url: normalizeOptionalString(item.url),
                        fileId: normalizeOptionalString(item.fileId),
                    }))
                    .filter((item) => item.url || item.fileId)
                    .slice(0, canUseMultiReference ? undefined : 1)
                : [],
        [canUseImageToImage, canUseMultiReference, sourceImages],
    );
    const primarySourceImage = usableSourceImages[0];
    const effectiveHasReferenceImage = usableSourceImages.length > 0;
    const effectiveMode = effectiveHasReferenceImage ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE;

    const buildGenerationPayload = (includeRequestKey = false, includeClientMetadata = false): CreateGenerationParams => ({
        prompt,
        negativePrompt: canUseNegativePrompt ? normalizeOptionalString(negativePrompt) : undefined,
        referenceImageUrl: primarySourceImage?.url,
        referenceImageFileId: primarySourceImage?.fileId,
        sourceImages: usableSourceImages,
        modelId,
        size,
        n: imageCount,
        quality,
        style,
        responseFormat,
        mode: effectiveMode,
        requestKey: includeRequestKey ? crypto.randomUUID() : undefined,
        source: includeClientMetadata ? selectedModel?.source : undefined,
    });

    const handleEnhancePrompt = async () => {
        const value = prompt.trim();
        if (!value || !modelId) return;
        let enhanced: Awaited<ReturnType<NonNullable<GenerationFormProps["onEnhancePrompt"]>>> | undefined;
        try {
            enhanced = await onEnhancePrompt?.({ prompt: value, modelId, style });
        } catch {
            return;
        }
        if (enhanced?.prompt) {
            setPrompt(enhanced.prompt);
            if (!negativePrompt.trim()) {
                setNegativePrompt("低清晰度，畸形，重复元素，水印，错误文字，过度噪点");
            }
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await onSubmit(buildGenerationPayload(true));
    };

    useEffect(() => {
        if (!modelId || !prompt.trim()) return;
        onEstimateChange?.(buildGenerationPayload(false, true));
    }, [
        modelId,
        prompt,
        negativePrompt,
        size,
        imageCount,
        quality,
        style,
        responseFormat,
        referenceImageUrl,
        referenceImageFileId,
        sourceImages,
        usableSourceImages,
        effectiveHasReferenceImage,
        effectiveMode,
        canUseNegativePrompt,
        selectedModel?.source,
    ]);

    useEffect(() => {
        if (selectedModel && !canUseImageToImage && hasReferenceImage) {
            setReferenceImageUrl(undefined);
            setReferenceImageFileId(undefined);
            setAdditionalReferenceImages([]);
        }
    }, [selectedModel, canUseImageToImage, hasReferenceImage]);

    const clearAll = () => {
        setPrompt("");
        setNegativePrompt("");
        setReferenceImageUrl(undefined);
        setReferenceImageFileId(undefined);
        setAdditionalReferenceImages([]);
    };

    const hasContent = !!(prompt || negativePrompt || hasReferenceImage);
    const templateItems = [...templates.map((template) => ({ label: template.title, prompt: template.prompt })), ...promptTemplates].slice(0, 6);

    return (
        <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
            <CardContent className="p-0">
                <form onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/20 p-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-primary">创作指令</p>
                            <h2 className="mt-1 text-base font-semibold leading-none">描述你要的画面</h2>
                        </div>
                        {hasContent && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                onClick={clearAll}
                                className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="size-3.5" />
                                清空
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4 p-4">
                        <div className="space-y-2">
                            <div className="flex items-end justify-between gap-3">
                                <Label className="text-sm font-medium">提示词</Label>
                                <span className={cn("text-xs tabular-nums transition-colors", promptColor)}>
                                    {prompt.length}/4000
                                </span>
                            </div>
                            <Textarea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="描述画面、主体、环境、光线与风格。例如：未来城市雨后街道，霓虹倒影，电影感，超清细节。"
                                className="min-h-36 resize-y bg-background text-sm leading-relaxed placeholder:text-muted-foreground/60 sm:min-h-40"
                                disabled={loading}
                                required
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    disabled={loading || !prompt.trim() || !modelId}
                                    onClick={handleEnhancePrompt}
                                    variant="outline"
                                    size="sm"
                                    className="border-primary/30 bg-primary/5 text-primary"
                                >
                                    <WandSparkles className="size-3.5" />
                                    优化提示词
                                </Button>
                                <span className="text-xs text-muted-foreground">支持中文、英文，也支持中英混写。</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-semibold">灵感推荐</span>
                                <span className="hidden text-muted-foreground sm:inline">点一下快速填入</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {templateItems.map((template) => (
                                    <Button
                                        key={template.label}
                                        type="button"
                                        disabled={loading}
                                        onClick={() => setPrompt(template.prompt)}
                                        variant="outline"
                                        size="sm"
                                        className="min-w-0 justify-start rounded-md bg-muted/20 text-xs"
                                    >
                                        <Plus className="size-3.5 shrink-0" />
                                        <span className="truncate">{template.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <section className="rounded-lg border bg-muted/10 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <Label className="text-sm font-medium">模型与参考图</Label>
                                    <p className="mt-1 text-xs text-muted-foreground">只显示当前账号可用的生图模型。</p>
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    主站配置
                                </span>
                            </div>

                            <div className="mt-3 space-y-2">
                                <Select value={modelId} onValueChange={setModelId} disabled={loading || modelsLoading} required>
                                    <SelectTrigger className={cn("w-full", !modelId && "text-muted-foreground")}>
                                        <SelectValue placeholder={modelsLoading ? "加载模型中..." : "选择图片模型"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.length === 0 && !modelsLoading && (
                                            <div className="px-3 py-5 text-center text-xs leading-relaxed text-muted-foreground">
                                                <p className="mb-1 font-medium">没有可用的图片模型</p>
                                                <p>请先在主系统模型管理中启用 text-to-image 模型。</p>
                                            </div>
                                        )}
                                        {models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate">{model.name}</span>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {model.model}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedModel && (
                                    <p className="truncate text-xs text-muted-foreground">
                                        {selectedModel.model}
                                        {canUseImageToImage ? " / 支持参考图" : " / 文生图"}
                                        {canUseMultiReference ? " / 多参考" : ""}
                                    </p>
                                )}
                            </div>

                            {canUseImageToImage && (
                                <div className="mt-3 grid gap-3">
                                    <ReferenceImageUpload
                                        value={referenceImageUrl}
                                        label="参考图"
                                        description="上传或粘贴一张参考图"
                                        disabled={loading || !selectedModel}
                                        helperText="上传后将使用图生图模式。"
                                        onChange={(url, fileId) => {
                                            setReferenceImageUrl(url);
                                            setReferenceImageFileId(fileId);
                                        }}
                                    />
                                    {canUseMultiReference && (
                                        <div className="space-y-2">
                                            {additionalReferenceImages.map((item, index) => (
                                                <div key={index} className="relative">
                                                    <ReferenceImageUpload
                                                        value={item.url}
                                                        label={`参考图 ${index + 2}`}
                                                        description="额外参考图"
                                                        disabled={loading || !hasReferenceImage}
                                                        helperText="作为额外参考参与生成。"
                                                        onChange={(url, fileId) => {
                                                            setAdditionalReferenceImages((prev) =>
                                                                prev.map((image, currentIndex) =>
                                                                    currentIndex === index ? { url, fileId } : image,
                                                                ),
                                                            );
                                                        }}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        disabled={loading}
                                                        className="absolute right-1 top-1 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setAdditionalReferenceImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
                                                        }
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={loading || !hasReferenceImage || additionalReferenceImages.length >= 3}
                                                onClick={() => setAdditionalReferenceImages((prev) => [...prev, {}])}
                                            >
                                                <ImagePlus className="size-3.5" />
                                                添加参考图
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <div className="overflow-hidden rounded-lg border">
                            <Button
                                type="button"
                                disabled={loading}
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex h-auto w-full items-center justify-between rounded-none px-3 py-2.5 text-sm font-medium hover:bg-muted/30"
                                variant="ghost"
                            >
                                <span className="flex items-center gap-2">
                                    <ChevronDown
                                        className={cn(
                                            "size-4 text-muted-foreground transition-transform duration-200",
                                            showAdvanced && "rotate-180",
                                        )}
                                    />
                                    高级设置
                                </span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {size} / {quality === "hd" ? "HD" : "标准"} / {style === "vivid" ? "生动" : "自然"}
                                </span>
                            </Button>
                            {showAdvanced && (
                                <div className="border-t p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium">尺寸</Label>
                                            <Select value={size} onValueChange={setSize} disabled={loading}>
                                                <SelectTrigger className="h-9 w-full text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sizeOptions.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium">
                                                生成数量{isDalle3Like && <span className="ml-1 text-muted-foreground">(DALL-E 3 限制为 1)</span>}
                                            </Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={isDalle3Like ? 1 : 4}
                                                value={isDalle3Like ? 1 : n}
                                                disabled={loading || isDalle3Like}
                                                onChange={(event) => setN(event.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium">质量</Label>
                                            <Select value={quality} onValueChange={setQuality} disabled={loading}>
                                                <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {qualityOptions.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option === "hd" ? "HD" : option === "standard" ? "Standard" : option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium">风格</Label>
                                            <Select value={style} onValueChange={setStyle} disabled={loading}>
                                                <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {styleOptions.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option === "vivid" ? "Vivid (生动)" : option === "natural" ? "Natural (自然)" : option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-xs font-medium">返回格式</Label>
                                            <Select
                                                value={responseFormat}
                                                onValueChange={(value) => setResponseFormat(value as ImageResponseFormat)}
                                                disabled={loading}
                                            >
                                                <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={ImageResponseFormat.B64_JSON}>b64_json (兼容性更好)</SelectItem>
                                                    <SelectItem value={ImageResponseFormat.URL}>url (服务商链接)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-xs font-medium">
                                                反向提示词
                                                <span className="ml-1 font-normal text-muted-foreground">可选</span>
                                            </Label>
                                            <Textarea
                                                value={negativePrompt}
                                                onChange={(event) => setNegativePrompt(event.target.value)}
                                                placeholder="不希望出现在画面里的内容，例如：水印、错误文字、低清晰度。"
                                                className="min-h-16 resize-none text-sm"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="grid gap-1.5 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center">
                            <span className="inline-flex items-center gap-1.5 text-foreground">
                                <Zap className="size-4 text-amber-500" />
                                预计消耗 <strong className="text-base text-amber-700">{visibleEstimatedPower}</strong> 算力
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="size-3.5" />
                                失败按账务结果退款
                            </span>
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            disabled={!prompt.trim() || !modelId || loading}
                            loading={loading}
                            className="min-h-11 rounded-lg shadow-sm sm:min-w-36"
                        >
                            <Sparkles className="size-4" />
                            开始生成
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
