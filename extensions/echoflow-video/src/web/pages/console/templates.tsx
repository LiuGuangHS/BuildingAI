import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { safeJsonParse } from "@buildingai/stores";
import { Plus, Save, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConsolePage } from "../../components/console-page";
import {
    useConsoleVideoModelConfigsQuery,
    useConsoleVideoTemplatesQuery,
    useCreateVideoTemplateMutation,
    useDeleteVideoTemplateMutation,
    useUpdateVideoTemplateMutation,
} from "../../services";
import type { SaveVideoTemplateParams, VideoPromptTemplate } from "../../services/types/generation";

const abilityOptions = [
    ["text_to_video", "文生视频"],
    ["first_frame_i2v", "首帧图生视频"],
    ["reference_to_video", "参考图生视频"],
    ["video_editing", "视频编辑"],
    ["action_transfer", "动作迁移"],
    ["native_audio", "原生音频"],
] as const;

export default function ConsoleVideoTemplatesPage() {
    useDocumentHead({ title: "视频模板预设" });
    const { data, isLoading, refetch } = useConsoleVideoTemplatesQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateVideoTemplateMutation();
    const updateMutation = useUpdateVideoTemplateMutation();
    const deleteMutation = useDeleteVideoTemplateMutation();
    const [editing, setEditing] = useState<VideoPromptTemplate | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);

    const handleSave = async (form: SaveVideoTemplateParams) => {
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, data: form });
            } else {
                await createMutation.mutateAsync(form);
            }
            toast.success("模板已保存");
            setEditing(undefined);
            refetch();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    return (
        <ConsolePage>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">模板预设</h1>
                    <p className="text-muted-foreground text-sm">发布给用户端使用的 prompt 模板，可限定模型或能力类型。</p>
                </div>
                <Button onClick={() => {
                    setEditing(createDraft());
                    setEditorNonce((value) => value + 1);
                }}>
                    <Plus className="size-4" />
                    新增模板
                </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
                <Card>
                    <CardHeader>
                        <CardTitle>模板列表</CardTitle>
                        <CardDescription>用户端只读取启用模板。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {(data?.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{item.title}</div>
                                    <div className="text-muted-foreground truncate text-xs">
                                        {item.category} · {item.enabled ? "启用" : "停用"} · {item.abilityTypes?.join(", ") || "全部能力"}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditing(item);
                                        setEditorNonce((value) => value + 1);
                                    }}>编辑</Button>
                                    <Button variant="destructive" size="sm" onClick={async () => {
                                        await deleteMutation.mutateAsync(item.id);
                                        toast.success("已删除");
                                        refetch();
                                    }}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {!isLoading && (data?.items ?? []).length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                尚未配置模板。新增后用户端会显示快捷填充按钮。
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
                <TemplateEditor
                    key={`${editing?.id || "empty"}-${editorNonce}`}
                    value={editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(undefined)}
                />
            </div>
        </ConsolePage>
    );
}

function TemplateEditor({ value, onSave, onCancel }: { value?: VideoPromptTemplate; onSave: (data: SaveVideoTemplateParams) => void; onCancel: () => void }) {
    const idPrefix = useId();
    const { data: models } = useConsoleVideoModelConfigsQuery({ page: 1, pageSize: 100 });
    const [title, setTitle] = useState(value?.title ?? "");
    const [category, setCategory] = useState(value?.category ?? "default");
    const [prompt, setPrompt] = useState(value?.prompt ?? "");
    const [modelConfigId, setModelConfigId] = useState(value?.modelConfigId ?? "all");
    const [abilityTypes, setAbilityTypes] = useState<string[]>(value?.abilityTypes ?? []);
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [sortOrder, setSortOrder] = useState(String(value?.sortOrder ?? 0));
    const [defaultParams, setDefaultParams] = useState(JSON.stringify(value?.defaultParams ?? {}, null, 2));

    if (!value) {
        return <Card><CardHeader><CardTitle>模板编辑</CardTitle><CardDescription>选择模板或新增。</CardDescription></CardHeader></Card>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>模板编辑</CardTitle>
                <CardDescription>默认参数 JSON 可覆盖用户端表单默认值。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>标题</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                    <div className="space-y-2"><Label>分类</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} /></div>
                </div>
                <div className="space-y-2">
                    <Label>适用模型</Label>
                    <Select value={modelConfigId} onValueChange={setModelConfigId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部模型</SelectItem>
                            {(models?.items ?? []).map((model) => (
                                <SelectItem key={model.id} value={model.id}>{model.displayName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>适用能力</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {abilityOptions.map(([key, label]) => {
                            const checkboxId = `${idPrefix}-ability-${key}`;
                            return (
                            <Label key={key} htmlFor={checkboxId} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                <Checkbox
                                    id={checkboxId}
                                    checked={abilityTypes.includes(key)}
                                    onCheckedChange={(checked) => setAbilityTypes((current) =>
                                        checked ? [...current, key] : current.filter((item) => item !== key),
                                    )}
                                />
                                {label}
                            </Label>
                            );
                        })}
                    </div>
                </div>
                <div className="space-y-2"><Label>Prompt</Label><Textarea className="min-h-32" value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>排序</Label><Input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></div>
                    <div className="mt-7 flex h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm">
                        <Label className="text-sm">启用模板</Label>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>默认参数 JSON</Label>
                    <Textarea className="min-h-28 font-mono text-xs" value={defaultParams} onChange={(event) => setDefaultParams(event.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button onClick={() => {
                        try {
                            if (!title.trim() || !prompt.trim()) {
                                toast.error("请填写标题和 Prompt");
                                return;
                            }
                            onSave({
                                title,
                                category,
                                prompt,
                                abilityTypes,
                                modelConfigId: modelConfigId === "all" ? undefined : modelConfigId,
                                defaultParams: parseDefaultParams(defaultParams),
                                enabled,
                                sortOrder: Number(sortOrder || 0),
                            });
                        } catch {
                            toast.error("默认参数 JSON 格式错误");
                        }
                    }}>
                        <Save className="size-4" />
                        保存
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function createDraft(): VideoPromptTemplate {
    return {
        id: "",
        title: "",
        category: "default",
        prompt: "",
        abilityTypes: [],
        defaultParams: {},
        enabled: true,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
    };
}

function parseDefaultParams(value: string) {
    const parsed = safeJsonParse<unknown>(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("默认参数 JSON 格式错误");
    }
    return parsed as Record<string, unknown>;
}
