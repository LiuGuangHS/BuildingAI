import { useDocumentHead } from "@buildingai/hooks";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@buildingai/ui/components/ui/alert-dialog";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useConsoleTemplatesQuery, useCreateTemplateMutation, useDeleteTemplateMutation, useUpdateTemplateMutation } from "../../services";
import type { ImagePromptTemplate, SaveTemplateParams } from "../../services/types/template";

export default function ConsoleTemplatesPage() {
    useDocumentHead({ title: "绘画模板预设" });
    const { data, refetch } = useConsoleTemplatesQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateTemplateMutation();
    const updateMutation = useUpdateTemplateMutation();
    const deleteMutation = useDeleteTemplateMutation();
    const [editing, setEditing] = useState<ImagePromptTemplate | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);

    const handleSave = async (form: SaveTemplateParams) => {
        if (editing?.id) await updateMutation.mutateAsync({ id: editing.id, data: form });
        else await createMutation.mutateAsync(form);
        toast.success("模板已保存");
        setEditing(undefined);
        refetch();
    };

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">模板预设</h1>
                    <p className="text-muted-foreground text-sm">发布给用户端使用的 prompt 模板和默认参数。</p>
                </div>
                <Button onClick={() => {
                    setEditing(createDraft());
                    setEditorNonce((value) => value + 1);
                }}><Plus className="size-4" />新增模板</Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader><CardTitle>模板列表</CardTitle><CardDescription>用户端只展示启用模板。</CardDescription></CardHeader>
                    <CardContent className="space-y-3">
                        {(data?.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{item.title}</div>
                                    <div className="text-muted-foreground truncate text-xs">{item.category} · {item.enabled ? "启用" : "停用"}</div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditing(item);
                                        setEditorNonce((value) => value + 1);
                                    }}>编辑</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm"><Trash2 className="size-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>删除模板</AlertDialogTitle>
                                                <AlertDialogDescription>确认删除模板“{item.title}”？</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>取消</AlertDialogCancel>
                                                <AlertDialogAction
                                                    variant="destructive"
                                                    onClick={async () => {
                                                        await deleteMutation.mutateAsync(item.id);
                                                        toast.success("已删除");
                                                        refetch();
                                                    }}
                                                >
                                                    确认删除
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <TemplateEditor
                    key={`${editing?.id || "empty"}-${editorNonce}`}
                    value={editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(undefined)}
                />
            </div>
        </div>
    );
}

function TemplateEditor({ value, onSave, onCancel }: { value?: ImagePromptTemplate; onSave: (data: SaveTemplateParams) => void; onCancel: () => void }) {
    const [title, setTitle] = useState(value?.title ?? "");
    const [category, setCategory] = useState(value?.category ?? "default");
    const [prompt, setPrompt] = useState(value?.prompt ?? "");
    const [negativePrompt, setNegativePrompt] = useState(value?.negativePrompt ?? "");
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [defaultParams, setDefaultParams] = useState(JSON.stringify(value?.defaultParams ?? {}, null, 2));

    if (!value) return <Card><CardHeader><CardTitle>模板编辑</CardTitle><CardDescription>选择模板或新增。</CardDescription></CardHeader></Card>;

    return (
        <Card>
            <CardHeader><CardTitle>模板编辑</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2"><Label>标题</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="space-y-2"><Label>分类</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
                <div className="space-y-2"><Label>Prompt</Label><Textarea className="min-h-28" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
                <div className="space-y-2"><Label>反向提示词</Label><Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} /></div>
                <div className="space-y-2"><Label>默认参数 JSON</Label><Textarea className="min-h-28 font-mono text-xs" value={defaultParams} onChange={(e) => setDefaultParams(e.target.value)} /></div>
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <span>启用</span>
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button onClick={() => {
                        try {
                            onSave({ title, category, prompt, negativePrompt, enabled, defaultParams: JSON.parse(defaultParams) });
                        } catch {
                            toast.error("默认参数 JSON 格式错误");
                        }
                    }}><Save className="size-4" />保存</Button>
                </div>
            </CardContent>
        </Card>
    );
}

function createDraft(): ImagePromptTemplate {
    return {
        id: "",
        title: "",
        category: "default",
        prompt: "",
        defaultParams: {},
        enabled: true,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
    };
}
