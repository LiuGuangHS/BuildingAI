import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { CheckCircle2, Plus, Save, Search, Trash2, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleAvailableAiModelsQuery,
    useConsoleModelConfigsQuery,
    useCreateModelConfigMutation,
    useDeleteModelConfigMutation,
    useTestModelConfigMutation,
    useUpdateModelConfigMutation,
} from "../../services";
import type { AvailableAiModelOption, ImageModelConfig, SaveModelConfigParams } from "../../services/types/model-config";

const defaultJson = {
    capabilities: {
        textToImage: true,
        imageToImage: false,
        negativePrompt: true,
        seed: false,
    },
    defaultParams: { size: "1024x1024", quality: "standard", style: "vivid", n: 1, responseFormat: "b64_json" },
    allowedParams: {
        sizes: ["1024x1024", "1024x1792", "1792x1024"],
        qualities: ["standard", "hd"],
        styles: ["vivid", "natural"],
        maxImages: 4,
    },
};

const capabilityOptions = [
    ["textToImage", "文生图"],
    ["imageToImage", "图生图"],
    ["mask", "局部重绘"],
    ["multiReference", "多参考图"],
    ["negativePrompt", "反向提示词"],
    ["seed", "Seed"],
    ["outputFormat", "输出格式"],
    ["background", "背景"],
    ["moderation", "安全等级"],
    ["inputFidelity", "输入保真度"],
] as const;

export default function ConsoleModelsPage() {
    useDocumentHead({ title: "绘画模型配置" });
    const { data, isLoading, refetch } = useConsoleModelConfigsQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateModelConfigMutation();
    const updateMutation = useUpdateModelConfigMutation();
    const deleteMutation = useDeleteModelConfigMutation();
    const testMutation = useTestModelConfigMutation();
    const [editing, setEditing] = useState<ImageModelConfig | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);

    const items = data?.items ?? [];

    const handleSave = async (form: SaveModelConfigParams) => {
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, data: form });
                toast.success("模型配置已更新");
            } else {
                await createMutation.mutateAsync(form);
                toast.success("模型配置已创建");
            }
            setEditing(undefined);
            refetch();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">模型配置</h1>
                    <p className="text-muted-foreground text-sm">将主系统 AI 模型启用为绘画模型，并配置能力与默认参数。</p>
                </div>
                <Button onClick={() => {
                    setEditing(createDraft());
                    setEditorNonce((value) => value + 1);
                }}>
                    <Plus className="size-4" />
                    新增模型
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>已配置模型</CardTitle>
                        <CardDescription>Web 用户端只会看到已启用且主系统模型可用的项。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="truncate font-medium">{item.displayName}</div>
                                        <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "启用" : "停用"}</Badge>
                                    </div>
                                    <div className="text-muted-foreground mt-1 truncate text-xs">
                                        {item.aiModel?.provider?.name || item.aiModel?.provider?.provider || "-"} · {item.aiModel?.model || item.aiModelId}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                const result = await testMutation.mutateAsync(item.id);
                                                toast[result.success ? "success" : "error"](result.message || "测试完成");
                                            } catch (error) {
                                                toast.error(error instanceof Error ? error.message : "测试失败");
                                            }
                                        }}
                                    >
                                        <Wifi className="size-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditing(item);
                                        setEditorNonce((value) => value + 1);
                                    }}>编辑</Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={async () => {
                                            await deleteMutation.mutateAsync(item.id);
                                            toast.success("已删除");
                                            refetch();
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {!isLoading && items.length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                尚未配置绘画模型。先在主系统模型管理中配置 Provider 和模型，再在这里启用。
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <ModelConfigEditor
                    key={`${editing?.id || "empty"}-${editorNonce}`}
                    value={editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(undefined)}
                />
            </div>
        </div>
    );
}

function ModelConfigEditor({
    value,
    onSave,
    onCancel,
}: {
    value?: ImageModelConfig;
    onSave: (data: SaveModelConfigParams) => void;
    onCancel: () => void;
}) {
    const [aiModelId, setAiModelId] = useState(value?.aiModelId ?? "");
    const [displayName, setDisplayName] = useState(value?.displayName ?? "");
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [sortOrder, setSortOrder] = useState(String(value?.sortOrder ?? 0));
    const [modelKeyword, setModelKeyword] = useState("");
    const [apiMode, setApiMode] = useState(value?.apiMode ?? "images");
    const [responsesTransport, setResponsesTransport] = useState(value?.responsesTransport ?? "sse");
    const [requestPolicy, setRequestPolicy] = useState(value?.requestPolicy ?? "openai");
    const [capabilities, setCapabilities] = useState<Record<string, boolean>>({
        ...defaultJson.capabilities,
        ...(value?.capabilities ?? {}),
    });
    const [sizesText, setSizesText] = useState((value?.allowedParams?.sizes ?? defaultJson.allowedParams.sizes).join("\n"));
    const [qualitiesText, setQualitiesText] = useState((value?.allowedParams?.qualities ?? defaultJson.allowedParams.qualities).join("\n"));
    const [stylesText, setStylesText] = useState((value?.allowedParams?.styles ?? defaultJson.allowedParams.styles).join("\n"));
    const [maxImages, setMaxImages] = useState(String(value?.allowedParams?.maxImages ?? defaultJson.allowedParams.maxImages));
    const [defaultSize, setDefaultSize] = useState(String(value?.defaultParams?.size ?? defaultJson.defaultParams.size));
    const [defaultQuality, setDefaultQuality] = useState(String(value?.defaultParams?.quality ?? defaultJson.defaultParams.quality));
    const [defaultStyle, setDefaultStyle] = useState(String(value?.defaultParams?.style ?? defaultJson.defaultParams.style));
    const [defaultCount, setDefaultCount] = useState(String(value?.defaultParams?.n ?? defaultJson.defaultParams.n));
    const { data: availableModels, isLoading: modelsLoading } = useConsoleAvailableAiModelsQuery({
        keyword: modelKeyword || undefined,
        imageOnly: true,
        activeOnly: false,
    });
    const selectedAiModel = useMemo(
        () => availableModels?.find((model) => model.id === aiModelId),
        [availableModels, aiModelId],
    );
    const allowedParams = useMemo(() => ({
        sizes: parseLines(sizesText),
        qualities: parseLines(qualitiesText),
        styles: parseLines(stylesText),
        maxImages: Number(maxImages || defaultJson.allowedParams.maxImages),
    }), [sizesText, qualitiesText, stylesText, maxImages]);
    const defaultParams = useMemo(() => ({
        size: defaultSize,
        quality: defaultQuality,
        style: defaultStyle,
        n: Number(defaultCount || 1),
        responseFormat: "b64_json",
    }), [defaultSize, defaultQuality, defaultStyle, defaultCount]);
    const configPreview = useMemo(() => JSON.stringify({
        apiMode,
        responsesTransport,
        requestPolicy,
        capabilities,
        defaultParams,
        allowedParams,
    }, null, 2), [apiMode, responsesTransport, requestPolicy, capabilities, defaultParams, allowedParams]);

    useEffect(() => {
        if (!selectedAiModel || displayName) return;
        setDisplayName(selectedAiModel.name);
    }, [selectedAiModel, displayName]);

    if (!value) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>配置编辑</CardTitle>
                    <CardDescription>选择左侧模型或新增配置。</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">模型、计费和风控配置会共同决定用户端可用能力。</CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="size-5" />
                    配置编辑
                </CardTitle>
                <CardDescription>主系统模型 ID 必须来自后台模型管理。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>主系统模型</Label>
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-2.5 size-4" />
                        <Input
                            value={modelKeyword}
                            onChange={(event) => setModelKeyword(event.target.value)}
                            placeholder="搜索模型名称、模型 ID 或描述"
                            className="pl-9"
                        />
                    </div>
                    <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-2">
                        {modelsLoading ? (
                            <div className="text-muted-foreground px-2 py-5 text-center text-xs">加载主系统模型中...</div>
                        ) : null}
                        {(availableModels ?? []).map((model) => (
                            <ModelOption
                                key={model.id}
                                model={model}
                                selected={model.id === aiModelId}
                                currentConfigId={value.id}
                                onSelect={() => {
                                    setAiModelId(model.id);
                                    setDisplayName((current) => current || model.name);
                                }}
                            />
                        ))}
                        {!modelsLoading && (availableModels ?? []).length === 0 ? (
                            <div className="text-muted-foreground px-2 py-5 text-center text-xs">
                                未找到图片模型。请先在主系统模型管理中新增并启用 image 类型模型。
                            </div>
                        ) : null}
                    </div>
                    <div className="text-muted-foreground break-all text-xs">
                        当前模型 ID：{aiModelId || "未选择"}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>展示名称</Label>
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                        启用
                    </label>
                    <div className="space-y-1">
                        <Label>排序</Label>
                        <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label>API 模式</Label>
                        <Select value={apiMode} onValueChange={(item) => setApiMode(item as "images" | "responses")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="images">Images API</SelectItem>
                                <SelectItem value="responses">Responses API</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Responses 传输</Label>
                        <Select value={responsesTransport} onValueChange={(item) => setResponsesTransport(item as "sse" | "websocket" | "auto")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sse">SSE</SelectItem>
                                <SelectItem value="websocket">WebSocket</SelectItem>
                                <SelectItem value="auto">Auto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>请求兼容策略</Label>
                        <Select value={requestPolicy} onValueChange={(item) => setRequestPolicy(item as "openai" | "compat")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="compat">兼容服务商</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>模型能力</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {capabilityOptions.map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={capabilities[key] ?? false}
                                    onChange={(event) => setCapabilities((current) => ({
                                        ...current,
                                        [key]: event.target.checked,
                                    }))}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ListField label="允许尺寸" value={sizesText} onChange={setSizesText} placeholder="1024x1024" />
                    <ListField label="允许质量" value={qualitiesText} onChange={setQualitiesText} placeholder="standard" />
                    <ListField label="允许风格" value={stylesText} onChange={setStylesText} placeholder="vivid" />
                    <div className="space-y-2">
                        <Label>单次最大张数</Label>
                        <Input type="number" min={1} max={10} value={maxImages} onChange={(event) => setMaxImages(event.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>默认尺寸</Label>
                        <Input value={defaultSize} onChange={(event) => setDefaultSize(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>默认质量</Label>
                        <Input value={defaultQuality} onChange={(event) => setDefaultQuality(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>默认风格</Label>
                        <Input value={defaultStyle} onChange={(event) => setDefaultStyle(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>默认张数</Label>
                        <Input type="number" min={1} value={defaultCount} onChange={(event) => setDefaultCount(event.target.value)} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>配置预览</Label>
                    <Textarea className="min-h-44 font-mono text-xs" value={configPreview} readOnly />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button
                        onClick={() => {
                            if (!aiModelId) {
                                toast.error("请选择主系统模型");
                                return;
                            }
                            if (!displayName.trim()) {
                                toast.error("请填写展示名称");
                                return;
                            }
                            onSave({
                                aiModelId,
                                displayName,
                                enabled,
                                sortOrder: Number(sortOrder || 0),
                                apiMode,
                                responsesTransport,
                                requestPolicy,
                                capabilities,
                                defaultParams,
                                allowedParams,
                            });
                        }}
                    >
                        <Save className="size-4" />
                        保存
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ModelOption({
    model,
    selected,
    currentConfigId,
    onSelect,
}: {
    model: AvailableAiModelOption;
    selected: boolean;
    currentConfigId?: string;
    onSelect: () => void;
}) {
    const configuredElsewhere = model.configured && !selected && !currentConfigId;
    const providerInactive = model.provider?.isActive === false;
    const modelInactive = model.isActive === false;

    return (
        <button
            type="button"
            disabled={configuredElsewhere}
            onClick={onSelect}
            className={cn(
                "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
                configuredElsewhere && "cursor-not-allowed opacity-50",
            )}
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{model.name}</span>
                    <Badge variant="outline">{model.modelType || "unknown"}</Badge>
                    {modelInactive || providerInactive ? <Badge variant="destructive">未启用</Badge> : null}
                    {model.configured ? <Badge variant="secondary">已配置</Badge> : null}
                </div>
                <div className="text-muted-foreground mt-1 truncate text-xs">
                    {model.provider?.name || model.provider?.provider || "-"} · {model.model}
                </div>
                {model.features?.length ? (
                    <div className="text-muted-foreground mt-1 truncate text-xs">
                        {model.features.slice(0, 5).join(", ")}
                    </div>
                ) : null}
            </div>
            {selected ? <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" /> : null}
        </button>
    );
}

function ListField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Textarea
                className="min-h-20 font-mono text-xs"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={`${placeholder}\n每行一个值`}
            />
        </div>
    );
}

function parseLines(value: string) {
    return value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function createDraft(): ImageModelConfig {
    return {
        id: "",
        aiModelId: "",
        displayName: "",
        enabled: true,
        apiMode: "images",
        responsesTransport: "sse",
        requestPolicy: "openai",
        capabilities: defaultJson.capabilities,
        defaultParams: defaultJson.defaultParams,
        allowedParams: defaultJson.allowedParams,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
    };
}
