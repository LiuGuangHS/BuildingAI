import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Label } from "@buildingai/ui/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@buildingai/ui/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { getLocalStorage, safeJsonParse, safeJsonStringify } from "@buildingai/stores";
import { cn } from "@buildingai/ui/lib/utils";
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
    modelsError?: boolean;
    initialValues?: Partial<CreateGenerationParams>;
    templates?: ImagePromptTemplate[];
    estimatedPower?: number;
    onSubmit: (data: CreateGenerationParams) => Promise<void> | void;
    onEstimateChange?: (data: CreateGenerationParams) => void;
    onEnhancePrompt?: (data: { prompt: string; modelId: string; style?: string }) => Promise<{ prompt: string; source: "ai" }>;
}

const promptTemplates = [
    { label: "雨夜街景", category: "风景", mark: "雨", prompt: "未来城市雨后街道，霓虹倒影落在湿润路面，低机位构图，电影感光影，清晰细节" },
    { label: "山湖清晨", category: "风景", mark: "山", prompt: "清晨山间湖泊，薄雾、雪山倒影和自然柔光，照片级写实，画面干净" },
    { label: "枫叶庭院", category: "空间", mark: "庭", prompt: "日式庭院，枫叶、石灯、木质回廊和秋日柔光，安静克制，细节丰富" },
    { label: "产品静物", category: "产品", mark: "物", prompt: "极简产品静物摄影，浅色背景，柔和工作室光，材质清晰，商业级质感" },
    { label: "机甲战场", category: "风格", mark: "机", prompt: "未来机甲站在雾气战场，金属结构清晰，低角度构图，电影感，强细节" },
    { label: "室内软装", category: "空间", mark: "室", prompt: "现代室内空间，落地窗、织物沙发、植物与自然光，温和色彩，高级家居摄影" },
    { label: "人像写真", category: "人物", mark: "像", prompt: "自然光人像写真，干净背景，柔和肤色，浅景深，真实表情，商业摄影质感" },
    { label: "海边日落", category: "风景", mark: "海", prompt: "海边日落，金色余晖、浪花和远处帆影，宽画幅构图，温暖电影色彩" },
    { label: "动漫少女", category: "人物", mark: "漫", prompt: "动漫风少女角色设定，清晰线条，细致服装，柔和背景光，精致插画质感" },
    { label: "包装海报", category: "产品", mark: "包", prompt: "高端饮品包装海报，产品居中，水珠质感，干净排版，商业广告摄影" },
];

const FAVORITE_TEMPLATE_STORAGE_KEY = "echoflow-image:favorite-template-prompts:v1";
const QUICK_TEMPLATE_COUNT = 6;

interface TemplateItem {
    label: string;
    category: string;
    prompt: string;
    mark: string;
    coverImageUrl?: string;
    favorite?: boolean;
}

const sizePresets = [
    { label: "1:1", description: "方图", mark: "□", match: (value: string) => value === "1024x1024" },
    { label: "竖图", description: "9:16", mark: "▯", match: (value: string) => {
        const [width, height] = value.split("x").map((item) => Number(item));
        return height > width;
    } },
    { label: "横图", description: "16:9", mark: "▭", match: (value: string) => {
        const [width, height] = value.split("x").map((item) => Number(item));
        return width > height;
    } },
];

function normalizeOptionalString(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function readFavoritePrompts() {
    try {
        const raw = getLocalStorage().getItem(FAVORITE_TEMPLATE_STORAGE_KEY);
        return safeJsonParse<string[]>(raw) ?? [];
    } catch {
        return [];
    }
}

function writeFavoritePrompts(values: string[]) {
    try {
        getLocalStorage().setItem(FAVORITE_TEMPLATE_STORAGE_KEY, safeJsonStringify(values));
    } catch {
        // Local template favorites are a convenience only; generation should keep working if storage is unavailable.
    }
}

function getTemplateMark(template: ImagePromptTemplate, index: number) {
    return template.title.trim().slice(0, 1) || String(index + 1);
}

function getModelAbilityLabels(model?: ImageModelOption) {
    if (!model) return [];
    const labels = ["文生图"];
    if (model.capabilities?.imageToImage) labels.push("参考图");
    if (model.capabilities?.multiReference) labels.push("多参考");
    if (model.capabilities?.negativePrompt !== false) labels.push("反向词");
    return labels;
}

function getModelDescription(model?: ImageModelOption) {
    if (!model) return "选择可用模型后开始创作。";
    const feature = model.features?.[0];
    if (feature) return feature;
    return `${model.model}${model.capabilities?.imageToImage ? "，支持参考图生成" : "，适合文生图任务"}`;
}

export function GenerationForm({
    loading,
    models = [],
    modelsLoading,
    modelsError,
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
    const [showAllTemplates, setShowAllTemplates] = useState(false);
    const [favoritePrompts, setFavoritePrompts] = useState<string[]>(() => readFavoritePrompts());

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
    const abilityLabels = useMemo(() => getModelAbilityLabels(selectedModel), [selectedModel]);

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
    const powerPerImage = Math.max(1, Math.ceil(visibleEstimatedPower / Math.max(imageCount, 1)));
    const disabledReason = !modelId
        ? "请选择模型"
        : !prompt.trim()
            ? "请输入提示词"
            : loading
                ? "生成中"
                : undefined;

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

    const buildGenerationPayload = (includeRequestKey = false): CreateGenerationParams => ({
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
        onEstimateChange?.(buildGenerationPayload());
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
    const templateItems = useMemo<TemplateItem[]>(() => {
        const remoteTemplates = templates.map((template, index) => ({
            label: template.title,
            category: template.category || "模板",
            prompt: template.prompt,
            mark: getTemplateMark(template, index),
            coverImageUrl: template.coverImageUrl,
        }));
        const merged = [...remoteTemplates, ...promptTemplates];
        const deduped = Array.from(new Map(merged.map((template) => [template.prompt, template])).values());
        return deduped
            .map((template) => ({ ...template, favorite: favoritePrompts.includes(template.prompt) }))
            .sort((left, right) => Number(right.favorite) - Number(left.favorite));
    }, [favoritePrompts, templates]);
    const visibleTemplateItems = showAllTemplates ? templateItems : templateItems.slice(0, QUICK_TEMPLATE_COUNT);

    const applyTemplate = (template: TemplateItem, mode: "replace" | "append") => {
        setPrompt((current) => {
            if (mode === "append" && current.trim()) {
                return `${current.trim()}，${template.prompt}`;
            }
            return template.prompt;
        });
        if (!negativePrompt.trim()) {
            const remoteTemplate = templates.find((item) => item.prompt === template.prompt);
            if (remoteTemplate?.negativePrompt) setNegativePrompt(remoteTemplate.negativePrompt);
        }
    };

    const toggleFavoriteTemplate = (template: TemplateItem) => {
        setFavoritePrompts((current) => {
            const exists = current.includes(template.prompt);
            const next = exists
                ? current.filter((promptValue) => promptValue !== template.prompt)
                : [template.prompt, ...current].slice(0, 12);
            writeFavoritePrompts(next);
            return next;
        });
    };

    const selectSizePreset = (presetIndex: number) => {
        const preset = sizePresets[presetIndex];
        const matched = sizeOptions.find((option) => preset.match(option));
        if (matched) setSize(matched);
    };

    return (
        <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
            <CardContent className="p-0">
                <form onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/20 p-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-primary">创作指令</p>
                            <h2 className="mt-1 text-base font-semibold leading-none">输入提示词</h2>
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
                                <span aria-hidden="true" className="text-xs leading-none">×</span>
                                清空
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4 p-4">
                        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 shadow-sm">
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
                                className="mt-2 min-h-36 resize-y border-primary/20 bg-background text-sm leading-relaxed shadow-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary/25 sm:min-h-40"
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
                                    <span aria-hidden="true" className="text-xs leading-none">✦</span>
                                    优化提示词
                                </Button>
                                <span className="text-xs text-muted-foreground">支持中文、英文，也支持中英混写。</span>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10 p-3">
                            <div className="flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0">
                                    <span className="font-semibold">灵感推荐</span>
                                    <span className="ml-2 text-muted-foreground">
                                        {favoritePrompts.length ? "收藏优先显示" : "点一下快速填入"}
                                    </span>
                                </div>
                                {templateItems.length > QUICK_TEMPLATE_COUNT && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={loading}
                                        onClick={() => setShowAllTemplates((value) => !value)}
                                        className="h-7 shrink-0 px-2 text-xs"
                                    >
                                        {showAllTemplates ? "收起" : "更多"}
                                    </Button>
                                )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {visibleTemplateItems.map((template) => (
                                    <Popover key={`${template.label}-${template.prompt}`}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                disabled={loading}
                                                variant="outline"
                                                className="h-auto min-w-0 justify-start rounded-md bg-background p-2 text-left shadow-xs hover:border-primary/30 hover:bg-primary/[0.03]"
                                            >
                                                {template.coverImageUrl ? (
                                                    <img
                                                        src={template.coverImageUrl}
                                                        alt=""
                                                        className="size-9 shrink-0 rounded-md object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground"
                                                    >
                                                        {template.mark}
                                                    </span>
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="truncate text-xs font-medium">{template.label}</span>
                                                        {template.favorite && <span className="text-[11px] text-amber-600">★</span>}
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                                                        {template.category}
                                                    </span>
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-2" align="start">
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-sm font-medium">{template.label}</p>
                                                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                                                        {template.prompt}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <Button type="button" size="sm" onClick={() => applyTemplate(template, "replace")}>
                                                        替换
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => applyTemplate(template, "append")}
                                                        disabled={!prompt.trim()}
                                                    >
                                                        追加
                                                    </Button>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="w-full justify-center text-xs text-muted-foreground"
                                                    onClick={() => toggleFavoriteTemplate(template)}
                                                >
                                                    {template.favorite ? "取消收藏" : "收藏模板"}
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
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
                                    <span className={cn("size-1.5 rounded-full", selectedModel ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                                    {selectedModel ? "可用" : modelsLoading ? "加载中" : "待配置"}
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
                                                        {getModelDescription(model)}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {modelsError ? (
                                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                        图片模型加载失败，请稍后重试。
                                    </p>
                                ) : !modelsLoading && models.length === 0 ? (
                                    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                        暂无可用图片模型，请先在模型管理中启用。
                                    </p>
                                ) : selectedModel ? (
                                    <div className="rounded-md border bg-background px-3 py-2">
                                        <div className="flex min-w-0 items-center justify-between gap-2">
                                            <p className="min-w-0 truncate text-xs text-muted-foreground">{getModelDescription(selectedModel)}</p>
                                            <span className="shrink-0 text-[11px] text-muted-foreground">{selectedModel.model}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {abilityLabels.map((label) => (
                                                <span
                                                    key={label}
                                                    className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
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
                                                        <span aria-hidden="true" className="text-xs leading-none">×</span>
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
                                                <span aria-hidden="true" className="text-xs leading-none">＋</span>
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
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "text-sm text-muted-foreground transition-transform duration-200",
                                            showAdvanced && "rotate-180",
                                        )}
                                    >
                                        ▾
                                    </span>
                                    高级设置
                                </span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {size} / {quality === "hd" ? "HD" : "标准"} / {style === "vivid" ? "生动" : "自然"}
                                </span>
                            </Button>
                            {showAdvanced && (
                                <div className="border-t p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-xs font-medium">尺寸</Label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {sizePresets.map((preset, index) => {
                                                    const active = preset.match(size);
                                                    const disabled = !sizeOptions.some((option) => preset.match(option));
                                                    return (
                                                        <Button
                                                            key={preset.label}
                                                            type="button"
                                                            variant={active ? "default" : "outline"}
                                                            size="sm"
                                                            disabled={loading || disabled}
                                                            onClick={() => selectSizePreset(index)}
                                                            className="h-auto flex-col gap-1 py-2 text-xs"
                                                        >
                                                            <span aria-hidden="true" className="text-base leading-none">{preset.mark}</span>
                                                            <span>{preset.label}</span>
                                                        </Button>
                                                    );
                                                })}
                                            </div>
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

                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-xs font-medium">
                                                生成数量{isDalle3Like && <span className="ml-1 text-muted-foreground">(DALL-E 3 限制为 1)</span>}
                                            </Label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[1, 2, 4].map((count) => (
                                                    <Button
                                                        key={count}
                                                        type="button"
                                                        variant={imageCount === count ? "default" : "outline"}
                                                        size="sm"
                                                        disabled={loading || isDalle3Like || count > (selectedModel?.allowedParams?.maxImages ?? 4)}
                                                        onClick={() => setN(String(count))}
                                                        className="h-9"
                                                    >
                                                        {count} 张
                                                    </Button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                每张约 {powerPerImage} 算力，共 {visibleEstimatedPower} 算力
                                            </p>
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

                    <div className="flex flex-col gap-3 border-t bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="grid gap-1.5 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center">
                            <span className="inline-flex items-center gap-2 rounded-md border border-primary/15 bg-background px-2.5 py-1.5 text-foreground shadow-xs">
                                <span aria-hidden="true" className="text-amber-500">●</span>
                                <span>预计消耗</span>
                                <strong className="text-lg leading-none text-amber-700">{visibleEstimatedPower}</strong>
                                <span>算力</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span aria-hidden="true">✓</span>
                                失败按账务结果退款
                            </span>
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            disabled={Boolean(disabledReason)}
                            loading={loading}
                            className="min-h-11 rounded-lg shadow-sm sm:min-w-40"
                        >
                            <span aria-hidden="true">✦</span>
                            {disabledReason || "开始生成"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
