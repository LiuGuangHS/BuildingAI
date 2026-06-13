import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleVideoModelConfigsQuery,
    useCreateVideoModelConfigMutation,
    useDeleteVideoModelConfigMutation,
    useUpdateVideoModelConfigMutation,
} from "../../services";
import type { SaveVideoModelConfigParams, VideoMediaItem, VideoModelConfig } from "../../services/types/generation";

const abilityOptions = [
    ["text_to_video", "文生视频"],
    ["first_frame_i2v", "首帧图生视频"],
    ["reference_to_video", "参考图生视频"],
    ["video_editing", "视频编辑"],
    ["action_transfer", "动作迁移"],
    ["native_audio", "原生音频"],
] as const;

const mediaTypeOptions: Array<[VideoMediaItem["type"], string]> = [
    ["first_frame", "首帧图"],
    ["reference_image", "参考图"],
    ["video", "视频"],
];

export default function ConsoleVideoModelsPage() {
    useDocumentHead({ title: "视频模型配置" });
    const { data, isLoading, refetch } = useConsoleVideoModelConfigsQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateVideoModelConfigMutation();
    const updateMutation = useUpdateVideoModelConfigMutation();
    const deleteMutation = useDeleteVideoModelConfigMutation();
    const [editing, setEditing] = useState<VideoModelConfig | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);
    const items = data?.items ?? [];

    const handleSave = async (form: SaveVideoModelConfigParams) => {
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
                    <p className="text-muted-foreground text-sm">配置视频模型、素材要求、默认参数和用户端可见性。</p>
                </div>
                <Button onClick={() => {
                    setEditing(createDraft());
                    setEditorNonce((value) => value + 1);
                }}>
                    <Plus className="size-4" />
                    新增模型
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
                <Card>
                    <CardHeader>
                        <CardTitle>已配置模型</CardTitle>
                        <CardDescription>用户端只展示启用且可见的模型；未配置时后端会使用 HappyHorse 默认模型。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate font-medium">{item.displayName}</div>
                                        <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "启用" : "停用"}</Badge>
                                        <Badge variant={item.visibleToUser ? "outline" : "secondary"}>{item.visibleToUser ? "用户可见" : "仅后台"}</Badge>
                                    </div>
                                    <div className="text-muted-foreground mt-1 truncate text-xs">
                                        {item.provider} · {item.model}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
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
                                尚未写入模型配置。可以先使用内置 HappyHorse 默认配置，也可以在这里新增可运营配置。
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <ModelEditor
                    key={`${editing?.id || "empty"}-${editorNonce}`}
                    value={editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(undefined)}
                />
            </div>
        </div>
    );
}

function ModelEditor({
    value,
    onSave,
    onCancel,
}: {
    value?: VideoModelConfig;
    onSave: (data: SaveVideoModelConfigParams) => void;
    onCancel: () => void;
}) {
    const [provider, setProvider] = useState(value?.provider ?? "happyhorse");
    const [model, setModel] = useState(value?.model ?? "");
    const [displayName, setDisplayName] = useState(value?.displayName ?? "");
    const [description, setDescription] = useState(value?.description ?? "");
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [visibleToUser, setVisibleToUser] = useState(value?.visibleToUser ?? true);
    const [sortOrder, setSortOrder] = useState(String(value?.sortOrder ?? 0));
    const [abilityTypes, setAbilityTypes] = useState<string[]>(value?.capabilities?.abilityTypes ?? ["text_to_video"]);
    const [mediaTypes, setMediaTypes] = useState<VideoMediaItem["type"][]>((value?.capabilities?.mediaTypes ?? []) as VideoMediaItem["type"][]);
    const [resolutionsText, setResolutionsText] = useState((value?.capabilities?.resolutions ?? ["720P", "1080P"]).join("\n"));
    const [ratiosText, setRatiosText] = useState((value?.capabilities?.ratios ?? ["16:9", "9:16", "1:1"]).join("\n"));
    const [durationMin, setDurationMin] = useState(String(value?.capabilities?.duration?.min ?? 3));
    const [durationMax, setDurationMax] = useState(String(value?.capabilities?.duration?.max ?? 15));
    const [defaultDuration, setDefaultDuration] = useState(String(value?.defaultParams?.duration ?? 5));
    const [defaultResolution, setDefaultResolution] = useState(value?.defaultParams?.resolution ?? "720P");
    const [defaultRatio, setDefaultRatio] = useState(value?.defaultParams?.ratio ?? "16:9");
    const [watermark, setWatermark] = useState(value?.defaultParams?.watermark ?? true);

    const capabilities = useMemo(() => ({
        abilityTypes,
        mediaTypes,
        duration: {
            min: Number(durationMin || 1),
            max: Number(durationMax || 30),
        },
        resolutions: parseLines(resolutionsText),
        ratios: parseLines(ratiosText),
        fps: value?.capabilities?.fps ?? 24,
        format: value?.capabilities?.format ?? "mp4",
        apiContractVerified: value?.capabilities?.apiContractVerified ?? provider === "happyhorse",
    }), [abilityTypes, durationMax, durationMin, mediaTypes, provider, ratiosText, resolutionsText, value?.capabilities]);
    const defaultParams = useMemo(() => ({
        duration: Number(defaultDuration || 5),
        resolution: defaultResolution,
        ratio: defaultRatio || undefined,
        watermark,
    }), [defaultDuration, defaultResolution, defaultRatio, watermark]);
    const preview = useMemo(() => JSON.stringify({ capabilities, defaultParams }, null, 2), [capabilities, defaultParams]);

    if (!value) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>配置编辑</CardTitle>
                    <CardDescription>选择左侧模型或新增配置。</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">模型配置会决定用户端可选项、素材校验和默认参数。</CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>配置编辑</CardTitle>
                <CardDescription>模型 ID 必须与后端 Provider Adapter 支持的模型名一致。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>服务商</Label>
                        <Input value={provider} onChange={(event) => setProvider(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>模型 ID</Label>
                        <Input value={model} onChange={(event) => setModel(event.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>展示名称</Label>
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>描述</Label>
                    <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                        启用
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={visibleToUser} onChange={(event) => setVisibleToUser(event.target.checked)} />
                        用户可见
                    </label>
                    <div className="space-y-1">
                        <Label>排序</Label>
                        <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>模型能力</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {abilityOptions.map(([key, label]) => (
                            <ToggleLine key={key} checked={abilityTypes.includes(key)} label={label} onChange={(checked) => {
                                setAbilityTypes((current) => checked ? [...current, key] : current.filter((item) => item !== key));
                            }} />
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>素材类型</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {mediaTypeOptions.map(([key, label]) => (
                            <ToggleLine key={key} checked={mediaTypes.includes(key)} label={label} onChange={(checked) => {
                                setMediaTypes((current) => checked ? [...current, key] : current.filter((item) => item !== key));
                            }} />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <ListField label="允许分辨率" value={resolutionsText} onChange={setResolutionsText} placeholder="720P" />
                    <ListField label="允许比例" value={ratiosText} onChange={setRatiosText} placeholder="16:9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>最小时长</Label><Input type="number" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} /></div>
                    <div className="space-y-2"><Label>最大时长</Label><Input type="number" value={durationMax} onChange={(event) => setDurationMax(event.target.value)} /></div>
                    <div className="space-y-2"><Label>默认时长</Label><Input type="number" value={defaultDuration} onChange={(event) => setDefaultDuration(event.target.value)} /></div>
                    <div className="space-y-2"><Label>默认分辨率</Label><Input value={defaultResolution} onChange={(event) => setDefaultResolution(event.target.value)} /></div>
                    <div className="space-y-2"><Label>默认比例</Label><Input value={defaultRatio} onChange={(event) => setDefaultRatio(event.target.value)} /></div>
                    <label className="mt-7 flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
                        默认水印
                    </label>
                </div>
                <div className="space-y-2">
                    <Label>配置预览</Label>
                    <Textarea className="min-h-44 font-mono text-xs" value={preview} readOnly />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button onClick={() => {
                        if (!model.trim() || !displayName.trim()) {
                            toast.error("请填写模型 ID 和展示名称");
                            return;
                        }
                        onSave({
                            provider,
                            model,
                            displayName,
                            description,
                            enabled,
                            visibleToUser,
                            capabilities,
                            defaultParams,
                            sortOrder: Number(sortOrder || 0),
                        });
                    }}>
                        <Save className="size-4" />
                        保存
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ToggleLine({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            {label}
        </label>
    );
}

function ListField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
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

function createDraft(): VideoModelConfig {
    return {
        id: "",
        provider: "happyhorse",
        model: "",
        displayName: "",
        description: "",
        enabled: true,
        visibleToUser: true,
        capabilities: {
            abilityTypes: ["text_to_video"],
            mediaTypes: [],
            duration: { min: 3, max: 15 },
            resolutions: ["720P", "1080P"],
            ratios: ["16:9", "9:16", "1:1"],
            fps: 24,
            format: "mp4",
        },
        defaultParams: { duration: 5, resolution: "720P", ratio: "16:9", watermark: true },
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
    };
}
