import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { cn } from "@buildingai/ui/lib/utils";
import { CheckCircle2, KeyRound, Plus, Save, SlidersHorizontal, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleVideoModelConfigsQuery,
    useTestVideoModelEndpointMutation,
    useUpdateVideoModelConfigMutation,
} from "../../services";
import type { SaveVideoModelConfigParams, VideoModelConfig, VideoModelEndpoint } from "../../services/types/generation";

const abilityLabels: Record<string, string> = {
    text_to_video: "文生视频",
    first_frame_i2v: "首帧图生视频",
    reference_to_video: "参考图生视频",
    video_editing: "视频编辑",
    action_transfer: "动作迁移",
    digital_human: "数字人",
    native_audio: "原生音频",
};

const mediaLabels: Record<string, string> = {
    first_frame: "首帧图",
    reference_image: "参考图",
    video: "视频",
    audio: "音频",
};

export default function ConsoleVideoModelsPage() {
    useDocumentHead({ title: "视频模型配置" });
    const { data, isLoading, refetch } = useConsoleVideoModelConfigsQuery({ page: 1, pageSize: 100 });
    const updateMutation = useUpdateVideoModelConfigMutation();
    const testEndpointMutation = useTestVideoModelEndpointMutation({
        onSuccess: (result) => toast.success(result.message || "接入点配置可用"),
        onError: (error) => toast.error(error.message || "测试失败"),
    });
    const items = data?.items ?? [];
    const [selectedId, setSelectedId] = useState<string>();
    const selected = useMemo(
        () => items.find((item) => item.id === selectedId) ?? items[0],
        [items, selectedId],
    );

    useEffect(() => {
        if (!selectedId && items[0]?.id) {
            setSelectedId(items[0].id);
        }
    }, [items, selectedId]);

    const handleSave = async (id: string, form: SaveVideoModelConfigParams) => {
        try {
            await updateMutation.mutateAsync({ id, data: form });
            toast.success("模型配置已更新");
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
                    <p className="text-muted-foreground text-sm">模型目录固定，给每个模型配置一组或多组 Base URL / API Key 接入点。</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_520px]">
                <Card>
                    <CardHeader>
                        <CardTitle>固定视频模型</CardTitle>
                        <CardDescription>用户端只展示启用且用户可见、并配置了可用接入点的模型。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {items.map((item) => {
                            const ready = (item.endpoints ?? []).some((endpoint) => endpoint.enabled && endpoint.apiKeyMasked);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedId(item.id)}
                                    className={cn(
                                        "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                                        selected?.id === item.id ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate font-medium">{item.displayName}</div>
                                            <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "启用" : "停用"}</Badge>
                                            <Badge variant={item.visibleToUser ? "outline" : "secondary"}>{item.visibleToUser ? "用户可见" : "隐藏"}</Badge>
                                            <Badge variant={ready ? "default" : "destructive"}>{ready ? "已接入" : "未接入"}</Badge>
                                        </div>
                                        <div className="text-muted-foreground mt-1 truncate text-xs">
                                            {item.model}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {(item.capabilities?.abilityTypes ?? []).slice(0, 4).map((ability) => (
                                                <Badge key={ability} variant="secondary">{abilityLabels[ability] ?? ability}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    {selected?.id === item.id ? <CheckCircle2 className="text-primary size-5 shrink-0" /> : null}
                                </button>
                            );
                        })}
                        {!isLoading && items.length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                暂无内置模型配置，重启插件服务或执行首版升级后会自动补齐。
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <ModelOperationsEditor
                    value={selected}
                    saving={updateMutation.isPending}
                    testing={testEndpointMutation.isPending}
                    onSave={handleSave}
                    onTestEndpoint={(id, endpoint) => testEndpointMutation.mutateAsync({ id, data: endpoint })}
                />
            </div>
        </div>
    );
}

function ModelOperationsEditor({
    value,
    saving,
    testing,
    onSave,
    onTestEndpoint,
}: {
    value?: VideoModelConfig;
    saving: boolean;
    testing: boolean;
    onSave: (id: string, data: SaveVideoModelConfigParams) => void;
    onTestEndpoint: (id: string, data: VideoModelEndpoint) => Promise<unknown>;
}) {
    const [displayName, setDisplayName] = useState("");
    const [description, setDescription] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [visibleToUser, setVisibleToUser] = useState(true);
    const [sortOrder, setSortOrder] = useState("0");
    const [duration, setDuration] = useState("5");
    const [resolution, setResolution] = useState("");
    const [ratio, setRatio] = useState("");
    const [watermark, setWatermark] = useState(true);
    const [endpoints, setEndpoints] = useState<VideoModelEndpoint[]>([]);

    useEffect(() => {
        setDisplayName(value?.displayName ?? "");
        setDescription(value?.description ?? "");
        setEnabled(value?.enabled ?? true);
        setVisibleToUser(value?.visibleToUser ?? true);
        setSortOrder(String(value?.sortOrder ?? 0));
        setDuration(String(value?.defaultParams?.duration ?? 5));
        setResolution(value?.defaultParams?.resolution ?? "");
        setRatio(value?.defaultParams?.ratio ?? "");
        setWatermark(value?.defaultParams?.watermark ?? true);
        setEndpoints((value?.endpoints?.length ? value.endpoints : [makeEndpoint()]).map((endpoint, index) => ({
            ...endpoint,
            id: endpoint.id || `endpoint-${index + 1}`,
            apiKey: "",
        })));
    }, [value]);

    if (!value) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>模型配置</CardTitle>
                    <CardDescription>选择左侧模型后调整。</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">模型目录由插件内置。</CardContent>
            </Card>
        );
    }

    const resolutions = value.capabilities?.resolutions ?? [];
    const ratios = value.capabilities?.ratios ?? [];
    const durationOptions = getDurationOptions(value);
    const mediaTypes = value.capabilities?.mediaTypes ?? [];

    const savePayload = (): SaveVideoModelConfigParams => ({
        displayName,
        description,
        enabled,
        visibleToUser,
        sortOrder: Number(sortOrder || 0),
        defaultParams: {
            duration: Number(duration || value.defaultParams?.duration || 5),
            resolution,
            ratio: ratio || undefined,
            watermark,
        },
        endpoints: endpoints.map((endpoint, index) => ({
            ...endpoint,
            id: endpoint.id || `endpoint-${index + 1}`,
            name: endpoint.name || `接入点 ${index + 1}`,
            baseUrl: endpoint.baseUrl,
            apiKey: endpoint.apiKey?.trim() || undefined,
            enabled: endpoint.enabled,
            priority: Number(endpoint.priority ?? 100 - index),
            requestTimeoutMs: Number(endpoint.requestTimeoutMs ?? 120000),
            testTimeoutMs: Number(endpoint.testTimeoutMs ?? 15000),
            maxRetries: Number(endpoint.maxRetries ?? 2),
            retryDelayMs: Number(endpoint.retryDelayMs ?? 1000),
        })),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="size-5" />
                    模型配置
                </CardTitle>
                <CardDescription>{value.model}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <SwitchField label="启用模型" checked={enabled} onCheckedChange={setEnabled} />
                    <SwitchField label="用户可见" checked={visibleToUser} onCheckedChange={setVisibleToUser} />
                </div>

                <div className="space-y-2">
                    <Label>展示名称</Label>
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>

                <div className="space-y-2">
                    <Label>说明</Label>
                    <Input value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>排序</Label>
                        <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
                    </div>
                    <SelectField label="默认时长" value={duration} options={durationOptions.map(String)} suffix="秒" onValueChange={setDuration} />
                    <SelectField label="默认分辨率" value={resolution} options={resolutions} onValueChange={setResolution} />
                    {ratios.length ? (
                        <SelectField label="默认比例" value={ratio} options={ratios} onValueChange={setRatio} />
                    ) : (
                        <div className="space-y-2">
                            <Label>默认比例</Label>
                            <Input value="跟随输入" disabled />
                        </div>
                    )}
                </div>

                <SwitchField label="默认带水印" checked={watermark} onCheckedChange={setWatermark} />

                <div className="space-y-2">
                    <Label>固定能力</Label>
                    <div className="flex flex-wrap gap-2">
                        {(value.capabilities?.abilityTypes ?? []).map((ability) => (
                            <Badge key={ability} variant="secondary">{abilityLabels[ability] ?? ability}</Badge>
                        ))}
                        {mediaTypes.map((type) => (
                            <Badge key={type} variant="outline">{mediaLabels[type] ?? type}</Badge>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <Label>接入点</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEndpoints((items) => [...items, makeEndpoint(items.length)])}
                        >
                            <Plus className="size-4" />
                            添加
                        </Button>
                    </div>
                    {endpoints.map((endpoint, index) => (
                        <EndpointEditor
                            key={endpoint.id ?? index}
                            value={endpoint}
                            canRemove={endpoints.length > 1}
                            testing={testing}
                            onChange={(next) => setEndpoints((items) => items.map((item, itemIndex) => itemIndex === index ? next : item))}
                            onRemove={() => setEndpoints((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                            onTest={() => onTestEndpoint(value.id, endpoint)}
                        />
                    ))}
                </div>

                <Button
                    className="w-full"
                    disabled={saving}
                    onClick={() => {
                        if (!displayName.trim()) {
                            toast.error("展示名称不能为空");
                            return;
                        }
                        onSave(value.id, savePayload());
                    }}
                >
                    <Save className="size-4" />
                    {saving ? "保存中..." : "保存配置"}
                </Button>
            </CardContent>
        </Card>
    );
}

function EndpointEditor({
    value,
    canRemove,
    testing,
    onChange,
    onRemove,
    onTest,
}: {
    value: VideoModelEndpoint;
    canRemove: boolean;
    testing: boolean;
    onChange: (value: VideoModelEndpoint) => void;
    onRemove: () => void;
    onTest: () => void;
}) {
    const patch = (data: Partial<VideoModelEndpoint>) => onChange({ ...value, ...data });
    return (
        <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <KeyRound className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">{value.name || "接入点"}</span>
                    {value.apiKeyMasked ? <Badge variant="outline">{value.apiKeyMasked}</Badge> : null}
                </div>
                <div className="flex items-center gap-2">
                    <Switch checked={value.enabled} onCheckedChange={(checked) => patch({ enabled: checked })} />
                    <Button type="button" variant="ghost" size="icon" disabled={!canRemove} onClick={onRemove}>
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="名称" value={value.name} onChange={(next) => patch({ name: next })} />
                <Field label="优先级" type="number" value={String(value.priority ?? 100)} onChange={(next) => patch({ priority: Number(next) })} />
            </div>
            <Field label="Base URL" value={value.baseUrl} onChange={(next) => patch({ baseUrl: next })} />
            <Field label="API Key" type="password" value={value.apiKey ?? ""} placeholder={value.apiKeyMasked ? "留空保留当前密钥" : "请输入 API Key"} onChange={(next) => patch({ apiKey: next })} />
            <div className="grid gap-3 md:grid-cols-4">
                <Field label="请求超时" type="number" value={String(value.requestTimeoutMs ?? 120000)} onChange={(next) => patch({ requestTimeoutMs: Number(next) })} />
                <Field label="测试超时" type="number" value={String(value.testTimeoutMs ?? 15000)} onChange={(next) => patch({ testTimeoutMs: Number(next) })} />
                <Field label="重试次数" type="number" value={String(value.maxRetries ?? 2)} onChange={(next) => patch({ maxRetries: Number(next) })} />
                <Field label="重试延迟" type="number" value={String(value.retryDelayMs ?? 1000)} onChange={(next) => patch({ retryDelayMs: Number(next) })} />
            </div>
            <Button type="button" variant="outline" size="sm" disabled={testing} onClick={onTest}>
                <Zap className="size-4" />
                测试接入点
            </Button>
        </div>
    );
}

function Field({
    label,
    value,
    type,
    placeholder,
    onChange,
}: {
    label: string;
    value: string;
    type?: string;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function SwitchField({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span>{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    suffix,
    onValueChange,
}: {
    label: string;
    value: string;
    options: string[];
    suffix?: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>{option}{suffix ?? ""}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function getDurationOptions(value: VideoModelConfig) {
    const capability = value.capabilities?.duration;
    if (capability?.allowedValues?.length) {
        return capability.allowedValues;
    }
    const min = capability?.min ?? 3;
    const max = capability?.max ?? 15;
    return Array.from({ length: Math.max(max - min + 1, 1) }, (_, index) => min + index);
}

function makeEndpoint(index = 0): VideoModelEndpoint {
    return {
        id: `endpoint-${index + 1}`,
        name: index === 0 ? "主接口" : `备用接口 ${index}`,
        baseUrl: "https://api.echoflow.cn",
        apiKey: "",
        enabled: index === 0,
        priority: 100 - index,
        requestTimeoutMs: 120000,
        testTimeoutMs: 15000,
        maxRetries: 2,
        retryDelayMs: 1000,
    };
}
