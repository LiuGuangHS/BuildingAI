import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { ChevronDown, Eraser, Lightbulb, Plus, Sparkles, Trash2, WandSparkles, Zap } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
    ImageGenerationMode,
    ImageResponseFormat,
    type CreateGenerationParams,
    type ImageModelOption,
    type ImageSourceRecord,
} from "../services/types/generation";
import type { ImagePromptTemplate } from "../services/types/template";
import { MaskCanvas } from "./mask-canvas";
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
    onEnhancePrompt?: (data: { prompt: string; modelId?: string; style?: string }) => Promise<{ prompt: string; source: "ai" | "local" }>;
}

const promptTemplates = [
    { label: "赛博朋克", prompt: "赛博朋克风格的未来城市，雨夜，霓虹灯，高细节，4k，电影级光照" },
    { label: "自然风光", prompt: "壮丽的自然风光，雪山与湖泊，黄金时刻光线，超高细节，照片级写实" },
    { label: "动漫角色", prompt: "精美的动漫风格角色插画，柔和色彩，精致线条，日系动画风格" },
    { label: "产品渲染", prompt: "专业产品摄影，极简白色背景，柔和工作室灯光，商业级质感" },
];

function generateRequestKey(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    const [maskImageUrl, setMaskImageUrl] = useState<string | undefined>();
    const [maskImageFileId, setMaskImageFileId] = useState<string | undefined>();
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
        setMaskImageUrl(initialValues.maskImageUrl);
        setMaskImageFileId(initialValues.maskImageFileId);
        setModelId(initialValues.modelId ?? "");
        setSize(initialValues.size ?? "1024x1024");
        setN(String(initialValues.n ?? 1));
        setQuality(initialValues.quality ?? "standard");
        setStyle(initialValues.style ?? "vivid");
        setResponseFormat(initialValues.responseFormat ?? ImageResponseFormat.B64_JSON);
    }, [initialValues]);

    const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);
    const canUseImageToImage = selectedModel?.capabilities?.imageToImage === true;
    const canUseMultiReference = selectedModel?.capabilities?.multiReference === true;
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
    const hasMaskImage = Boolean(maskImageUrl || maskImageFileId);
    const sourceImages = useMemo(
        () => [
            ...(hasReferenceImage ? [{ url: referenceImageUrl, fileId: referenceImageFileId }] : []),
            ...additionalReferenceImages.filter((item) => item.url || item.fileId),
        ],
        [hasReferenceImage, referenceImageUrl, referenceImageFileId, additionalReferenceImages],
    );

    const handleEnhancePrompt = async () => {
        const value = prompt.trim();
        if (!value) return;
        const enhanced = await onEnhancePrompt?.({ prompt: value, modelId, style });
        if (enhanced?.prompt) {
            setPrompt(enhanced.prompt);
        } else {
            const styleHint = style === "natural" ? "自然色彩，真实光影" : "鲜明色彩，强视觉冲击";
            const qualityHint = quality === "hd" ? "超高细节，清晰边缘，专业质感" : "构图完整，主体明确，细节丰富";
            setPrompt(`${value}，${styleHint}，${qualityHint}，画面干净，背景协调`);
        }
        if (!negativePrompt.trim()) {
            setNegativePrompt("低清晰度，畸形，重复元素，水印，错误文字，过度噪点");
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await onSubmit({
            prompt,
            negativePrompt: negativePrompt || undefined,
            referenceImageUrl,
            referenceImageFileId,
            sourceImages,
            maskImageUrl,
            maskImageFileId,
            modelId,
            size,
            n: imageCount,
            quality,
            style,
            responseFormat,
            mode: hasReferenceImage ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE,
            requestKey: generateRequestKey(),
        });
    };

    useEffect(() => {
        if (!modelId || !prompt.trim()) return;
        onEstimateChange?.({
            prompt,
            negativePrompt: negativePrompt || undefined,
            referenceImageUrl,
            referenceImageFileId,
            sourceImages,
            maskImageUrl,
            maskImageFileId,
            modelId,
            size,
            n: imageCount,
            quality,
            style,
            responseFormat,
            mode: hasReferenceImage ? ImageGenerationMode.IMAGE_TO_IMAGE : ImageGenerationMode.TEXT_TO_IMAGE,
        });
    }, [modelId, size, imageCount, quality, style, responseFormat, referenceImageUrl, referenceImageFileId, sourceImages]);

    useEffect(() => {
        if (selectedModel && !canUseImageToImage && hasReferenceImage) {
            setReferenceImageUrl(undefined);
            setReferenceImageFileId(undefined);
            setAdditionalReferenceImages([]);
            setMaskImageUrl(undefined);
            setMaskImageFileId(undefined);
        }
    }, [selectedModel, canUseImageToImage, hasReferenceImage]);

    const clearAll = () => {
        setPrompt("");
        setNegativePrompt("");
        setReferenceImageUrl(undefined);
        setReferenceImageFileId(undefined);
        setAdditionalReferenceImages([]);
        setMaskImageUrl(undefined);
        setMaskImageFileId(undefined);
    };

    const hasContent = !!(prompt || negativePrompt || hasReferenceImage || hasMaskImage);

    return (
        <Card className="border-primary/10 bg-gradient-to-b from-background to-primary/[0.02] shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2.5 text-xl">
                            <div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
                                <WandSparkles className="text-primary size-5" />
                            </div>
                            创作台
                        </CardTitle>
                        <CardDescription className="mt-1">OpenAI-compatible Images API</CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                        {hasContent && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                onClick={clearAll}
                                className="text-muted-foreground hover:text-destructive h-8"
                            >
                                <Eraser className="size-3.5" />
                                <span className="ml-1.5 hidden sm:inline">清空</span>
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-5">
                <form onSubmit={handleSubmit}>
                    {/* ── Prompt area ── */}
                    <div className="space-y-2">
                        <div className="flex items-end justify-between">
                            <Label className="text-sm font-medium">提示词</Label>
                            <span className={cn("text-xs tabular-nums transition-colors", promptColor)}>
                                {prompt.length}/4000
                            </span>
                        </div>
                        <Textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder="描述你想生成的画面，例如：赛博朋克风格的未来城市，雨夜，霓虹灯，高细节..."
                            className="min-h-36 resize-none border-primary/20 text-sm leading-relaxed transition-all focus-within:border-primary/60 focus-within:shadow-sm placeholder:text-muted-foreground/60"
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* ── Template chips ── */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Lightbulb className="text-amber-500 size-3.5 shrink-0" />
                        <span className="text-muted-foreground mr-1 text-xs">灵感：</span>
                        <button
                            type="button"
                            disabled={loading || !prompt.trim()}
                            onClick={handleEnhancePrompt}
                            className={cn(
                                "rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-all",
                                "hover:bg-primary/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                        >
                            润色当前提示词
                        </button>
                        {[...templates.map((template) => ({ label: template.title, prompt: template.prompt })), ...promptTemplates].slice(0, 8).map((template) => (
                            <button
                                key={template.label}
                                type="button"
                                disabled={loading}
                                onClick={() => setPrompt(template.prompt)}
                                className={cn(
                                    "rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium transition-all",
                                    "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                                    "active:scale-95",
                                )}
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Model + Reference row ── */}
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">图片模型</Label>
                            <Select value={modelId} onValueChange={setModelId} disabled={loading || modelsLoading} required>
                                <SelectTrigger
                                    className={cn(
                                        "w-full border-primary/20 transition-all focus-within:border-primary/60",
                                        !modelId && "text-muted-foreground",
                                    )}
                                >
                                    <SelectValue placeholder={modelsLoading ? "加载模型中..." : "选择图片模型"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.length === 0 && !modelsLoading && (
                                        <div className="text-muted-foreground px-3 py-5 text-center text-xs leading-relaxed">
                                            <p className="mb-1 font-medium">没有可用的图片模型</p>
                                            <p>请在管理后台配置一个 modelType 含 &quot;image&quot; 的模型</p>
                                        </div>
                                    )}
                                    {models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate">{model.name}</span>
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {model.providerName || model.provider} · {model.model}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedModel && (
                                <p className="text-muted-foreground truncate text-xs">
                                    {selectedModel.providerName || selectedModel.provider} · {selectedModel.model}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <ReferenceImageUpload
                                value={referenceImageUrl}
                                disabled={loading || !selectedModel || !canUseImageToImage}
                                helperText={
                                    !selectedModel
                                        ? "选择支持图生图的模型后可上传参考图。"
                                        : canUseImageToImage
                                            ? "上传参考图后将使用图生图模式。"
                                            : "当前模型未启用图生图能力。"
                                }
                                onChange={(url, fileId) => {
                                    setReferenceImageUrl(url);
                                    setReferenceImageFileId(fileId);
                                    if (!url && !fileId) {
                                        setMaskImageUrl(undefined);
                                        setMaskImageFileId(undefined);
                                    }
                                }}
                            />
                            {canUseMultiReference && (
                                <div className="space-y-2">
                                    {additionalReferenceImages.map((item, index) => (
                                        <div key={index} className="relative">
                                            <ReferenceImageUpload
                                                value={item.url}
                                                label={`参考图 ${index + 2}`}
                                                description="Echoflow Image reference image"
                                                disabled={loading || !hasReferenceImage}
                                                helperText="作为额外参考图参与生成。"
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
                                        <Plus className="size-3.5" />
                                        添加参考图
                                    </Button>
                                </div>
                            )}
                            <ReferenceImageUpload
                                value={maskImageUrl}
                                label="上传遮罩图"
                                description="Echoflow Image mask image"
                                disabled={loading || !hasReferenceImage}
                                helperText={hasReferenceImage ? "黑白或透明遮罩用于局部重绘。" : "先上传参考图后可添加遮罩。"}
                                onChange={(url, fileId) => {
                                    setMaskImageUrl(url);
                                    setMaskImageFileId(fileId);
                                }}
                            />
                        </div>
                    </div>

                    <div className="mt-3">
                        <MaskCanvas
                            referenceImageUrl={referenceImageUrl}
                            disabled={loading || !hasReferenceImage}
                            onMaskGenerated={(url, fileId) => {
                                setMaskImageUrl(url);
                                setMaskImageFileId(fileId);
                            }}
                        />
                    </div>

                    {/* ── Collapsible advanced settings ── */}
                    <div className="mt-3 rounded-xl border border-border/60">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={cn(
                                "flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                                "hover:bg-muted/30",
                            )}
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
                            <span className="text-muted-foreground text-xs font-normal">
                                {size} · {quality === "hd" ? "HD" : "标准"} · {style === "vivid" ? "生动" : "自然"}
                            </span>
                        </button>
                        <div
                            className={cn(
                                "grid transition-all duration-200 ease-in-out",
                                showAdvanced
                                    ? "grid-rows-[1fr] opacity-100"
                                    : "grid-rows-[0fr] opacity-0",
                            )}
                        >
                            <div className="overflow-hidden">
                                <div className="grid gap-4 px-4 pb-4 pt-1 md:grid-cols-2 xl:grid-cols-3">
                                    {/* Size */}
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

                                    {/* Count */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">
                                            生成数量{isDalle3Like && <span className="text-muted-foreground ml-1">(DALL·E 3 限制为 1)</span>}
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

                                    {/* Quality */}
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

                                    {/* Style */}
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

                                    {/* Response format */}
                                    <div className="space-y-2">
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

                                    {/* Negative prompt */}
                                    <div className="space-y-2 md:col-span-2 xl:col-span-3">
                                        <Label className="text-xs font-medium">
                                            反向提示词
                                            <span className="text-muted-foreground ml-1 font-normal">(可选，将追加到生成请求)</span>
                                        </Label>
                                        <Textarea
                                            value={negativePrompt}
                                            onChange={(event) => setNegativePrompt(event.target.value)}
                                            placeholder="描述你不希望在画面中出现的内容..."
                                            className="min-h-16 resize-none text-sm"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Submit row ── */}
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/5 flex items-center gap-1.5 rounded-full border border-primary/10 px-3 py-1.5">
                                <Zap className="text-amber-500 size-3.5" />
                                <span className="text-xs font-medium">
                                    预计消耗 <span className="text-primary font-bold">{visibleEstimatedPower}</span> 算力
                                </span>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            disabled={!prompt.trim() || !modelId || loading}
                            loading={loading}
                            className={cn(
                                "group relative overflow-hidden border-0 shadow-md transition-all",
                                "bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90",
                                "active:scale-[0.98] disabled:opacity-50",
                                "sm:min-w-44",
                            )}
                        >
                            {!loading && (
                                <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100" />
                            )}
                            <Sparkles className="size-4" />
                            开始生成
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
