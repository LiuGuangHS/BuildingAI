import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { useMemo, useState } from "react";

import type { GeneratedImageRecord, ImageGeneration } from "../../services/types/generation";
import { ImageGenerationBillingStatus, ImageGenerationStatus } from "../../services/types/generation";
import {
    designArtwork,
    designCapabilityRows,
    designGenerations,
    designModels,
    designScenarioOptions,
    designTemplates,
    getDesignGeneration,
    type DesignScenario,
    type DesignTemplate,
} from "./design-fixtures";

type VariantId = "prompt-rail" | "light-table" | "storyboard";
type ViewportMode = "responsive" | "desktop" | "mobile";
type GalleryPanel = "brief" | "compare";

interface VariantDefinition {
    id: VariantId;
    label: string;
    eyebrow: string;
    thesis: string;
    optimizes: string;
    tradeoff: string;
    signature: string;
}

const variants: VariantDefinition[] = [
    {
        id: "prompt-rail",
        label: "A · 快速创作流",
        eyebrow: "Prompt first",
        thesis: "让提示词、关键参数、估价与生成按钮形成一条最短路径，结果与最近作品紧随其后。",
        optimizes: "首次生成速度、移动端完成率、现有组件复用",
        tradeoff: "成熟用户挑片空间较克制，高级参数默认折叠",
        signature: "把创作参数做成摄影暗房的窄控制轨，提交区像一张工作单",
    },
    {
        id: "light-table",
        label: "B · 中央光台",
        eyebrow: "Result first",
        thesis: "把选中作品完整铺在中央光台，缩略片、图片动作和参数检查器围绕结果组织。",
        optimizes: "横竖图审阅、多图挑选、下载复用、画布交接",
        tradeoff: "空状态需要更强引导，首次输入比 A 多一层空间转换",
        signature: "一张会响应画幅的数字灯箱，四角裁切线标记当前选中作品",
    },
    {
        id: "storyboard",
        label: "C · 叙事分镜台",
        eyebrow: "Iteration first",
        thesis: "将提示词版本、生成批次与选中作品组成可扫读的分镜带，强调连续创作而非单次生成。",
        optimizes: "多轮迭代、版本比较、从历史继续创作、项目感",
        tradeoff: "信息密度最高，需要更明确的移动端折叠策略",
        signature: "时间码式分镜轨把每次生成变成一格可复用的创作镜头",
    },
];

const ratioOptions = [
    { value: "1024x1024", label: "1:1", mark: "□" },
    { value: "1536x1024", label: "3:2", mark: "▭" },
    { value: "1024x1536", label: "2:3", mark: "▯" },
] as const;

const scenarioGroups = designScenarioOptions.reduce<Record<string, typeof designScenarioOptions>>((groups, option) => {
    groups[option.group] = [...(groups[option.group] ?? []), option];
    return groups;
}, {});

export default function DesignSandboxPage() {
    if (!import.meta.env.DEV) return null;

    const [activeVariant, setActiveVariant] = useState<VariantId>("prompt-rail");
    const [scenario, setScenario] = useState<DesignScenario>("success-multiple");
    const [viewport, setViewport] = useState<ViewportMode>("responsive");
    const [panel, setPanel] = useState<GalleryPanel>("brief");
    const [prompt, setPrompt] = useState(designTemplates[0].prompt);
    const [modelId, setModelId] = useState(designModels[0].id);
    const [size, setSize] = useState("1024x1024");
    const [count, setCount] = useState(2);
    const [quality, setQuality] = useState("standard");
    const [style, setStyle] = useState("natural");
    const [selectedImage, setSelectedImage] = useState(0);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [notice, setNotice] = useState("原型全部使用 public mock 数据，不会调用真实服务。");

    const variant = variants.find((item) => item.id === activeVariant) ?? variants[0];
    const generation = useMemo(() => getDesignGeneration(scenario), [scenario]);
    const modelsLoading = scenario === "models-loading";
    const modelsError = scenario === "models-error";
    const estimateLoading = scenario === "estimate-loading";
    const estimateError = scenario === "estimate-error";
    const reserved = scenario === "reserved";
    const estimatedPower = Math.max(20, count * (quality === "hd" ? 70 : 40));

    const prototypeProps: PrototypeProps = {
        scenario,
        generation,
        prompt,
        onPromptChange: setPrompt,
        modelId,
        onModelChange: setModelId,
        size,
        onSizeChange: setSize,
        count,
        onCountChange: setCount,
        quality,
        onQualityChange: setQuality,
        style,
        onStyleChange: setStyle,
        selectedImage,
        onSelectedImageChange: setSelectedImage,
        advancedOpen,
        onAdvancedOpenChange: setAdvancedOpen,
        templateOpen,
        onTemplateOpenChange: setTemplateOpen,
        modelsLoading,
        modelsError,
        estimateLoading,
        estimateError,
        reserved,
        estimatedPower,
        onAction: setNotice,
    };

    return (
        <div className="ef-image-workbench ef-image-design-gallery mx-auto grid w-full max-w-[1680px] gap-4 p-3 md:p-4">
            <Card className="overflow-hidden border-dashed shadow-sm">
                <div className="ef-image-design-masthead border-b px-4 py-5 md:px-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-4xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="font-mono tracking-[0.16em]">DEV ONLY</Badge>
                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">EchoFlow Image / Design Gallery</span>
                            </div>
                            <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-4xl">三种创作节奏，同一套真实能力边界</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                                比较快速生成、结果审阅与连续迭代三种工作台方向。所有控件可交互，但只改变本地原型状态；生成、估价、上传、计费与 provider 均不会发出请求。
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Tabs value={viewport} onValueChange={(value) => setViewport(value as ViewportMode)}>
                                <TabsList>
                                    <TabsTrigger value="responsive">响应式</TabsTrigger>
                                    <TabsTrigger value="desktop">1440px</TabsTrigger>
                                    <TabsTrigger value="mobile">390px</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Tabs value={panel} onValueChange={(value) => setPanel(value as GalleryPanel)}>
                                <TabsList>
                                    <TabsTrigger value="brief">契约</TabsTrigger>
                                    <TabsTrigger value="compare">对比</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                </div>

                <CardContent className="grid gap-4 p-4 md:p-6">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <Tabs value={activeVariant} onValueChange={(value) => setActiveVariant(value as VariantId)}>
                            <TabsList className="h-auto flex-wrap justify-start">
                                {variants.map((item) => (
                                    <TabsTrigger key={item.id} value={item.id} className="min-h-9">{item.label}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <Select value={scenario} onValueChange={(value) => {
                            setScenario(value as DesignScenario);
                            setSelectedImage(0);
                        }}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(scenarioGroups).map(([group, options]) => (
                                    <div key={group}>
                                        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{group}</div>
                                        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {panel === "brief" ? (
                        <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{variant.eyebrow}</p>
                                <p className="mt-2 text-base font-semibold">{variant.thesis}</p>
                                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                                    <p><strong className="text-foreground">优化：</strong>{variant.optimizes}</p>
                                    <p><strong className="text-foreground">取舍：</strong>{variant.tradeoff}</p>
                                </div>
                                <p className="mt-3 rounded-md border border-dashed bg-background/70 px-3 py-2 text-sm"><strong>记忆点：</strong>{variant.signature}</p>
                            </div>
                            <CapabilityPanel compact />
                        </div>
                    ) : (
                        <ComparisonPanel activeVariant={activeVariant} />
                    )}

                    <div role="status" aria-live="polite" className="flex min-h-9 items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
                        <span>{notice}</span>
                        <span className="hidden font-mono uppercase tracking-[0.12em] sm:inline">{scenario.replaceAll("-", " ")}</span>
                    </div>
                </CardContent>
            </Card>

            <div className={cn(
                "transition-[max-width] duration-300 motion-reduce:transition-none",
                viewport === "desktop" && "mx-auto w-full max-w-[1440px]",
                viewport === "mobile" && "mx-auto w-full max-w-[390px]",
            )}>
                {viewport === "mobile" ? (
                    <MobilePrototype variant={activeVariant} {...prototypeProps} />
                ) : activeVariant === "prompt-rail" ? (
                    <PromptRailPrototype {...prototypeProps} />
                ) : activeVariant === "light-table" ? (
                    <LightTablePrototype {...prototypeProps} />
                ) : (
                    <StoryboardPrototype {...prototypeProps} />
                )}
            </div>
        </div>
    );
}

interface PrototypeProps {
    scenario: DesignScenario;
    generation?: ImageGeneration;
    prompt: string;
    onPromptChange: (value: string) => void;
    modelId: string;
    onModelChange: (value: string) => void;
    size: string;
    onSizeChange: (value: string) => void;
    count: number;
    onCountChange: (value: number) => void;
    quality: string;
    onQualityChange: (value: string) => void;
    style: string;
    onStyleChange: (value: string) => void;
    selectedImage: number;
    onSelectedImageChange: (value: number) => void;
    advancedOpen: boolean;
    onAdvancedOpenChange: (value: boolean) => void;
    templateOpen: boolean;
    onTemplateOpenChange: (value: boolean) => void;
    modelsLoading: boolean;
    modelsError: boolean;
    estimateLoading: boolean;
    estimateError: boolean;
    reserved: boolean;
    estimatedPower: number;
    onAction: (message: string) => void;
}

function PromptRailPrototype(props: PrototypeProps) {
    return (
        <PrototypeFrame variant="prompt-rail" title="快速创作流" subtitle="让创作指令与提交保持在一个视线区域">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(330px,390px)_minmax(0,1fr)]">
                <ComposerPanel {...props} compact />
                <div className="grid min-w-0 content-start gap-3">
                    <ArtworkStage {...props} mode="balanced" />
                    <HistoryStrip {...props} />
                </div>
            </div>
        </PrototypeFrame>
    );
}

function LightTablePrototype(props: PrototypeProps) {
    return (
        <PrototypeFrame variant="light-table" title="中央光台" subtitle="完整画幅、选片与素材动作优先">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(310px,360px)]">
                <div className="grid min-w-0 content-start gap-3">
                    <ArtworkStage {...props} mode="light-table" />
                    <ContactSheet {...props} />
                </div>
                <ComposerPanel {...props} inspector />
            </div>
        </PrototypeFrame>
    );
}

function StoryboardPrototype(props: PrototypeProps) {
    return (
        <PrototypeFrame variant="storyboard" title="叙事分镜台" subtitle="把每次生成变成一格可以继续推演的创作镜头">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
                <ComposerPanel {...props} storyboard />
                <div className="grid min-w-0 content-start gap-3">
                    <StoryboardRail {...props} />
                    <ArtworkStage {...props} mode="storyboard" />
                </div>
            </div>
        </PrototypeFrame>
    );
}

function MobilePrototype({ variant, ...props }: PrototypeProps & { variant: VariantId }) {
    const hasResult = Boolean(props.generation?.resultImages.length);
    const title = variants.find((item) => item.id === variant)?.label ?? "移动原型";

    return (
        <PrototypeFrame variant={variant} title={`${title} · 390px`} subtitle="真实移动组合，不依赖桌面断点缩容">
            <div className="grid gap-3">
                {variant === "light-table" && hasResult ? <ArtworkStage {...props} mode="mobile" /> : null}
                {variant === "storyboard" ? <StoryboardRail {...props} mobile /> : null}
                <ComposerPanel {...props} compact mobile />
                {variant !== "light-table" || !hasResult ? <ArtworkStage {...props} mode="mobile" /> : null}
                {variant === "light-table" ? <ContactSheet {...props} /> : <HistoryStrip {...props} />}
            </div>
        </PrototypeFrame>
    );
}

function PrototypeFrame({
    variant,
    title,
    subtitle,
    children,
}: {
    variant: VariantId;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <section className={cn("ef-image-prototype overflow-hidden rounded-xl border bg-background shadow-sm", `ef-image-prototype-${variant}`)}>
            <header className="ef-image-prototype-header flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Interactive HTML prototype</p>
                    <h2 className="mt-1 text-base font-semibold">{title}</h2>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">响应式</Badge>
                    <Badge variant="outline">Public mock</Badge>
                    <Badge variant="secondary">无真实请求</Badge>
                </div>
            </header>
            <div className="p-3 md:p-4">{children}</div>
        </section>
    );
}

function ComposerPanel({
    prompt,
    onPromptChange,
    modelId,
    onModelChange,
    size,
    onSizeChange,
    count,
    onCountChange,
    quality,
    onQualityChange,
    style,
    onStyleChange,
    modelsLoading,
    modelsError,
    estimateLoading,
    estimateError,
    reserved,
    estimatedPower,
    advancedOpen,
    onAdvancedOpenChange,
    templateOpen,
    onTemplateOpenChange,
    onAction,
    compact,
    inspector,
    storyboard,
    mobile,
}: PrototypeProps & { compact?: boolean; inspector?: boolean; storyboard?: boolean; mobile?: boolean }) {
    const selectedModel = designModels.find((model) => model.id === modelId) ?? designModels[0];

    return (
        <Card className={cn(
            "min-w-0 gap-0 overflow-hidden py-0 shadow-sm",
            !mobile && compact && "xl:sticky xl:top-3",
            inspector && "ef-image-inspector",
            storyboard && "ef-image-story-form",
        )}>
            <CardHeader className="border-b px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-base">{inspector ? "创作检查器" : storyboard ? "下一镜头" : "创作指令"}</CardTitle>
                        <CardDescription className="mt-1">
                            {inspector ? "结果在左，参数在这里随时校对。" : storyboard ? "延续上一格，也可以开启新方向。" : "描述画面，确认关键参数，然后生成。"}
                        </CardDescription>
                    </div>
                    <span className="ef-image-step-index" aria-hidden="true">01</span>
                </div>
            </CardHeader>

            <CardContent className="grid gap-4 p-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`design-prompt-${inspector ? "inspector" : storyboard ? "story" : "quick"}`}>画面描述</Label>
                        <Button type="button" variant="ghost" size="sm" disabled={modelsLoading || modelsError} onClick={() => onAction("已模拟提示词润色；原型未调用真实 LLM。")}>优化提示词</Button>
                    </div>
                    <Textarea
                        id={`design-prompt-${inspector ? "inspector" : storyboard ? "story" : "quick"}`}
                        value={prompt}
                        onChange={(event) => onPromptChange(event.target.value)}
                        className={cn("resize-none", compact ? "min-h-28" : "min-h-36")}
                        placeholder="例如：雨夜未来城市，潮湿路面倒映霓虹……"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{prompt.length} / 4000</span>
                        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => onTemplateOpenChange(!templateOpen)}>{templateOpen ? "收起灵感" : "从灵感模板开始"}</button>
                    </div>
                </div>

                {templateOpen ? <TemplateTray onSelect={(template) => {
                    onPromptChange(template.prompt);
                    onAction(`已应用模板「${template.title}」；只更新本地原型。`);
                }} /> : null}

                <div className="grid gap-3">
                    <div className="space-y-2">
                        <Label>模型</Label>
                        <Select value={modelId} onValueChange={onModelChange} disabled={modelsLoading || modelsError}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={modelsLoading ? "加载模型中…" : "选择图片模型"} />
                            </SelectTrigger>
                            <SelectContent>
                                {designModels.map((model) => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {modelsLoading ? <InlineState tone="neutral" title="正在读取可用模型" description="提交按钮会在模型准备好后启用。" /> : null}
                        {modelsError ? <InlineState tone="danger" title="图片模型没有加载成功" description="检查连接后重试；当前原型不会发送请求。" action="重试模型" onAction={() => onAction("已模拟重试模型列表。")}/> : null}
                        {!modelsLoading && !modelsError ? (
                            <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline">{selectedModel.name}</Badge>
                                <Badge variant="secondary">文生图 ready</Badge>
                                <Badge variant="outline">最多 {selectedModel.allowedParams?.maxImages} 张</Badge>
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label>画幅</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {ratioOptions.map((ratio) => (
                                <Button key={ratio.value} type="button" variant={size === ratio.value ? "default" : "outline"} className="h-auto flex-col gap-1 py-2" onClick={() => onSizeChange(ratio.value)}>
                                    <span aria-hidden="true" className="text-lg leading-none">{ratio.mark}</span>
                                    <span className="text-xs">{ratio.label}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>数量</Label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {[1, 2, 4].map((value) => <Button key={value} type="button" size="sm" variant={count === value ? "default" : "outline"} onClick={() => onCountChange(value)}>{value} 张</Button>)}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>风格</Label>
                            <Select value={style} onValueChange={onStyleChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="natural">自然</SelectItem>
                                    <SelectItem value="vivid">生动</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border">
                    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium hover:bg-muted/30" onClick={() => onAdvancedOpenChange(!advancedOpen)}>
                        <span>高级设置</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">{size} · {quality === "hd" ? "HD" : "标准"} · PNG</span>
                    </button>
                    {advancedOpen ? (
                        <div className="grid gap-3 border-t bg-muted/10 p-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>质量</Label>
                                <Select value={quality} onValueChange={onQualityChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="standard">标准</SelectItem>
                                        <SelectItem value="hd">HD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>输出格式</Label>
                                <Select defaultValue="png">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="png">PNG</SelectItem>
                                        <SelectItem value="webp">WebP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor={`design-negative-${inspector ? "inspector" : storyboard ? "story" : "quick"}`}>反向提示词</Label>
                                <Input id={`design-negative-${inspector ? "inspector" : storyboard ? "story" : "quick"}`} placeholder="当前 runtime 未开放，原型保持禁用" disabled />
                            </div>
                        </div>
                    ) : null}
                </div>

                {reserved ? <ReservedPanel /> : null}
            </CardContent>

            <div className={cn("ef-image-submit-dock border-t px-4 py-3", mobile && "sticky bottom-0 z-10")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <EstimateBlock loading={estimateLoading} error={estimateError} amount={estimatedPower} onRetry={() => onAction("已模拟重新估价。")}/>
                    <Button type="button" size="lg" className="min-h-11 sm:min-w-36" disabled={modelsLoading || modelsError || reserved} onClick={() => onAction("已模拟提交生成；原型没有调用生成或扣费接口。")}>{reserved ? "能力未开放" : "开始生成"}</Button>
                </div>
            </div>
        </Card>
    );
}

function TemplateTray({ onSelect }: { onSelect: (template: DesignTemplate) => void }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {designTemplates.map((template) => (
                <button key={template.id} type="button" className="group rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelect(template)}>
                    <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold text-white" style={{ backgroundColor: template.accent }}>{template.mark}</span>
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">{template.title}</span>
                            <span className="block text-xs text-muted-foreground">{template.category}</span>
                        </span>
                    </div>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">{template.prompt}</span>
                </button>
            ))}
        </div>
    );
}

function EstimateBlock({ loading, error, amount, onRetry }: { loading: boolean; error: boolean; amount: number; onRetry: () => void }) {
    if (loading) return <div role="status" aria-live="polite" className="text-sm"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" />正在获取后端估价…</div>;
    if (error) return <div role="alert" className="flex items-center gap-2 text-sm text-destructive"><span>估价暂不可用</span><button type="button" className="underline underline-offset-4" onClick={onRetry}>重试</button></div>;
    return (
        <div className="text-sm">
            <span className="text-muted-foreground">后端估价</span>
            <strong className="mx-2 text-xl tabular-nums text-amber-700 dark:text-amber-300">{amount}</strong>
            <span className="text-muted-foreground">算力 · 失败按账务结果处理</span>
        </div>
    );
}

function ArtworkStage(props: PrototypeProps & { mode: "balanced" | "light-table" | "storyboard" | "mobile" }) {
    const { scenario, generation, selectedImage, onSelectedImageChange, onAction, mode } = props;
    const images = generation?.resultImages ?? [];
    const selected = images[Math.min(selectedImage, Math.max(images.length - 1, 0))];
    const selectedSrc = selected?.url;
    const isRunning = scenario === "pending" || scenario === "processing";
    const isFailed = scenario === "failed";
    const isEmpty = !generation && !isRunning && !isFailed;

    return (
        <Card className={cn("ef-image-prototype-stage min-w-0 gap-0 overflow-hidden py-0 shadow-sm", mode === "light-table" && "ef-image-prototype-lamp") }>
            <CardHeader className="border-b px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base">{mode === "storyboard" ? "当前镜头" : "结果舞台"}</CardTitle>
                        <CardDescription>{generation ? `${generation.modelName} · ${generation.size} · ${generation.n} 张` : "生成完成后，作品会完整停在这里。"}</CardDescription>
                    </div>
                    <TaskBadge scenario={scenario} billingStatus={generation?.billingStatus} />
                </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
                {isRunning ? <RunningStage scenario={scenario} prompt={generation?.prompt} /> : isFailed ? <FailedStage generation={generation} onRetry={() => onAction("已模拟重试失败任务。")}/> : isEmpty ? <EmptyStage onUsePrompt={(value) => {
                    props.onPromptChange(value);
                    onAction("已将建议提示词写入本地原型。")
                }} reserved={scenario === "reserved"}/> : (
                    <div className="grid gap-3">
                        <div className="ef-image-artwork-mat ef-image-contact-frame relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-lg border bg-muted/20 md:min-h-[520px]">
                            {selectedSrc ? <img src={selectedSrc} alt={`选中的生成作品 ${selectedImage + 1}`} className="max-h-[72vh] w-full object-contain" /> : null}
                            <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-end gap-1.5 opacity-100 sm:inset-x-3 sm:bottom-3">
                                <StageAction label="下载" onClick={() => onAction(`已模拟下载作品 ${selectedImage + 1}。`)} />
                                <StageAction label="复制提示词" onClick={() => onAction("已模拟复制当前作品提示词。")}/>
                                <StageAction label="再次生成" onClick={() => onAction("已将当前参数准备为下一次生成草稿。")}/>
                                <StageAction label="整理到画布" primary onClick={() => onAction(`已模拟把作品 ${selectedImage + 1} 加入画布。`)}/>
                            </div>
                        </div>
                        {images.length > 1 ? (
                            <div className="grid grid-cols-4 gap-2" aria-label="生成结果缩略图">
                                {images.map((image, index) => <ArtworkThumb key={`${generation?.id}:${index}`} image={image} index={index} selected={selectedImage === index} onClick={() => onSelectedImageChange(index)} />)}
                            </div>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ArtworkThumb({ image, index, selected, onClick }: { image: GeneratedImageRecord; index: number; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" aria-label={`选择作品 ${index + 1}`} aria-pressed={selected} className={cn("ef-image-artwork-thumb relative overflow-hidden rounded-md border bg-muted/20 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary ring-1 ring-primary/30")} onClick={onClick}>
            <img src={image.url} alt="" className="aspect-square size-full rounded-sm object-contain" />
            <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[10px]">{String(index + 1).padStart(2, "0")}</span>
        </button>
    );
}

function StageAction({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
    return <Button type="button" size="sm" variant={primary ? "default" : "secondary"} className="min-h-9 bg-background/92 shadow-sm backdrop-blur-sm hover:bg-background dark:bg-background/90" onClick={onClick}>{label}</Button>;
}

function RunningStage({ scenario, prompt }: { scenario: DesignScenario; prompt?: string }) {
    return (
        <div className="relative flex min-h-[420px] overflow-hidden rounded-lg border border-dashed bg-muted/15 p-5">
            <div className="ef-image-stage-grid" aria-hidden="true" />
            <div role="status" aria-live="polite" aria-busy="true" className="relative m-auto max-w-md text-center">
                <span className="mx-auto block size-12 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none" />
                <p className="mt-5 text-lg font-semibold">{scenario === "pending" ? "任务正在排队" : "图片正在生成"}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{prompt || "正在准备本次图片任务。"}</p>
                <p className="mt-4 text-xs text-muted-foreground">这里只呈现后端真实公开的 pending / processing 状态，不制造进度百分比。</p>
            </div>
        </div>
    );
}

function FailedStage({ generation, onRetry }: { generation?: ImageGeneration; onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/[0.03] p-6 text-center">
            <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full border border-destructive/30 text-xl text-destructive">!</span>
            <h3 className="mt-4 text-lg font-semibold text-destructive">本次生成没有完成</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{generation?.errorMessage}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={onRetry}>重试失败任务</Button>
                <Button type="button" variant="outline">复用参数</Button>
            </div>
            <Badge variant="secondary" className="mt-4">账务状态：已退款</Badge>
        </div>
    );
}

function EmptyStage({ onUsePrompt, reserved }: { onUsePrompt: (prompt: string) => void; reserved: boolean }) {
    return (
        <div className="relative flex min-h-[420px] overflow-hidden rounded-lg border border-dashed bg-muted/10 p-5">
            <div className="ef-image-stage-grid" aria-hidden="true" />
            <div className="relative m-auto max-w-lg text-center">
                <span aria-hidden="true" className="mx-auto flex size-16 items-center justify-center rounded-lg border bg-background font-serif text-3xl text-primary shadow-sm">✦</span>
                <h3 className="mt-4 text-lg font-semibold">{reserved ? "能力边界保持清晰" : "从一句画面描述开始"}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{reserved ? "参考图、多参考、局部重绘与高级 provider 参数仍处于 reserved，不会进入提交 payload。" : "选择一个提示词起点，或在创作面板中写下自己的构图、材质和光线。"}</p>
                {!reserved ? (
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {designTemplates.slice(0, 3).map((template) => <Button key={template.id} type="button" variant="outline" size="sm" onClick={() => onUsePrompt(template.prompt)}>{template.title}</Button>)}
                    </div>
                ) : <CapabilityPanel compact className="mt-5 text-left" />}
            </div>
        </div>
    );
}

function ContactSheet(props: PrototypeProps) {
    const images = props.generation?.resultImages.length ? props.generation.resultImages : designGenerations[0].resultImages;
    return (
        <Card className="ef-image-contact-strip gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div><CardTitle className="text-sm">接触印样</CardTitle><CardDescription>快速比较构图，再回到中央光台精看。</CardDescription></div>
                    <Badge variant="outline">{images.length} frames</Badge>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-2 p-3">
                {images.map((image, index) => <ArtworkThumb key={`contact:${index}`} image={image} index={index} selected={props.selectedImage === index} onClick={() => props.onSelectedImageChange(index)} />)}
            </CardContent>
        </Card>
    );
}

function HistoryStrip(props: PrototypeProps) {
    const items = designGenerations.filter((item) => item.status === ImageGenerationStatus.SUCCEEDED || item.status === ImageGenerationStatus.FAILED).slice(0, 4);
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-sm">最近作品</CardTitle><CardDescription>继续创作，而不是只读归档。</CardDescription></div><Button type="button" variant="ghost" size="sm">查看全部</Button></div>
            </CardHeader>
            <CardContent className="grid auto-cols-[minmax(180px,1fr)] grid-flow-col gap-2 overflow-x-auto p-3">
                {items.map((item, index) => (
                    <div key={item.id} className="min-w-0 rounded-lg border bg-background p-2">
                        <div className="flex gap-2">
                            <img src={item.resultImages[0]?.url || designArtwork.square} alt="" className="size-16 shrink-0 rounded-md border object-contain" />
                            <div className="min-w-0"><p className="line-clamp-2 text-xs font-medium">{item.prompt}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.size} · {item.modelName}</p></div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <Button type="button" size="sm" variant="outline" onClick={() => props.onAction(`已模拟复用最近作品 ${index + 1} 的参数。`)}>复用参数</Button>
                            {item.status === ImageGenerationStatus.FAILED ? <Button type="button" size="sm" onClick={() => props.onAction("已模拟重试失败任务。")}>重试</Button> : <Button type="button" size="sm" onClick={() => props.onAction("已模拟再次生成。")}>再次生成</Button>}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function StoryboardRail(props: PrototypeProps & { mobile?: boolean }) {
    const frames = [
        { time: "00:01", label: "原始提示", image: designArtwork.square, active: false },
        { time: "00:18", label: "宽幅探索", image: designArtwork.landscape, active: props.scenario.includes("landscape") },
        { time: "00:42", label: "当前镜头", image: props.generation?.resultImages[props.selectedImage]?.url || designArtwork.portrait, active: true },
        { time: "NEXT", label: "下一分支", image: undefined, active: false },
    ];

    return (
        <Card className="ef-image-storyboard-rail gap-0 overflow-hidden py-0 shadow-sm">
            <CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm">创作分镜</CardTitle><CardDescription>每一格保留提示、参数与结果关系。</CardDescription></CardHeader>
            <CardContent className={cn("grid gap-2 p-3", props.mobile ? "grid-cols-2" : "grid-cols-4")}>
                {frames.map((frame, index) => (
                    <button key={`${frame.time}:${index}`} type="button" className={cn("relative min-w-0 overflow-hidden rounded-lg border bg-background p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", frame.active && "border-primary ring-1 ring-primary/25")} onClick={() => props.onAction(`已选择分镜 ${frame.time}。`)}>
                        <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted/30">{frame.image ? <img src={frame.image} alt="" className="size-full object-contain" /> : <div className="flex size-full items-center justify-center text-2xl text-muted-foreground">＋</div>}</div>
                        <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{frame.label}</span><span className="font-mono text-[10px] text-muted-foreground">{frame.time}</span></div>
                    </button>
                ))}
            </CardContent>
        </Card>
    );
}

function TaskBadge({ scenario, billingStatus }: { scenario: DesignScenario; billingStatus?: ImageGeneration["billingStatus"] }) {
    if (scenario === "pending") return <Badge variant="outline">排队中</Badge>;
    if (scenario === "processing") return <Badge variant="secondary">生成中</Badge>;
    if (scenario === "failed") return <Badge variant="destructive">失败 · {billingStatus === ImageGenerationBillingStatus.REFUNDED ? "已退款" : "待核对"}</Badge>;
    if (scenario.startsWith("success")) return <Badge>已完成</Badge>;
    if (scenario === "reserved") return <Badge variant="secondary">Reserved</Badge>;
    return <Badge variant="outline">等待创作</Badge>;
}

function ReservedPanel() {
    return (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="flex items-start gap-3">
                <span aria-hidden="true" className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase">reserved</span>
                <div><p className="text-sm font-medium">二阶段能力不会进入本次提交</p><p className="mt-1 text-xs leading-5 text-muted-foreground">参考图、多参考、局部重绘、seed、background、input fidelity 与 moderation 继续由后端 capability 收敛。</p></div>
            </div>
        </div>
    );
}

function CapabilityPanel({ compact, className }: { compact?: boolean; className?: string }) {
    return (
        <div className={cn("rounded-lg border bg-background p-3", className)}>
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">能力矩阵</p><Badge variant="outline">Public only</Badge></div>
            <div className={cn("mt-3 grid gap-2", !compact && "sm:grid-cols-2")}>
                {designCapabilityRows.map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-3 rounded-md border bg-muted/15 px-2.5 py-2 text-xs">
                        <div><p className="font-medium text-foreground">{row.label}</p>{!compact ? <p className="mt-0.5 text-muted-foreground">{row.note}</p> : null}</div>
                        <Badge variant={row.state === "ready" ? "default" : "secondary"}>{row.state}</Badge>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ComparisonPanel({ activeVariant }: { activeVariant: VariantId }) {
    const rows = [
        ["首要任务", "最快完成首次生成", "最快审阅和处理结果", "最快回看并继续迭代"],
        ["空间结构", "窄控制轨 + 结果", "中央灯箱 + 检查器", "分镜轨 + 当前镜头"],
        ["390px", "关键参数直达 CTA", "结果与创作面板切换", "两列分镜 + 线性创作"],
        ["实现风险", "低到中", "中", "中到高"],
        ["记忆点", "暗房工作单", "响应画幅数字灯箱", "时间码式创作分镜"],
    ];

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-muted/30"><tr><th className="p-3 font-medium">维度</th>{variants.map((variant) => <th key={variant.id} className={cn("p-3 font-medium", variant.id === activeVariant && "bg-primary/[0.06] text-primary")}>{variant.label}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row[0]} className="border-t"><th className="p-3 text-xs font-medium text-muted-foreground">{row[0]}</th>{row.slice(1).map((cell, index) => <td key={cell} className={cn("p-3", variants[index].id === activeVariant && "bg-primary/[0.03]")}>{cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}

function InlineState({ tone, title, description, action, onAction }: { tone: "neutral" | "danger"; title: string; description: string; action?: string; onAction?: () => void }) {
    return (
        <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-xs", tone === "danger" ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-muted/20 text-muted-foreground")}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{title}</p><p className="mt-1 opacity-80">{description}</p></div>{action ? <button type="button" className="shrink-0 underline underline-offset-4" onClick={onAction}>{action}</button> : null}</div>
        </div>
    );
}
