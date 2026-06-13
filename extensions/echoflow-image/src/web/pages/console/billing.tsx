import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
    useConsoleBillingRulesQuery,
    useConsoleModelConfigsQuery,
    useCreateBillingRuleMutation,
    useDeleteBillingRuleMutation,
    useUpdateBillingRuleMutation,
} from "../../services";
import type { ImageBillingRule, SaveBillingRuleParams } from "../../services/types/billing";
import type { ImageModelConfig } from "../../services/types/model-config";

export default function ConsoleBillingPage() {
    useDocumentHead({ title: "绘画计费策略" });
    const { data, isLoading, refetch } = useConsoleBillingRulesQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateBillingRuleMutation();
    const updateMutation = useUpdateBillingRuleMutation();
    const deleteMutation = useDeleteBillingRuleMutation();
    const [editing, setEditing] = useState<ImageBillingRule | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);

    const handleSave = async (data: SaveBillingRuleParams) => {
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, data });
                toast.success("计费规则已更新");
            } else {
                await createMutation.mutateAsync(data);
                toast.success("计费规则已创建");
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
                    <h1 className="text-2xl font-semibold tracking-tight">计费策略</h1>
                    <p className="text-muted-foreground text-sm">按模型、模式、尺寸、质量和张数计算算力消耗。</p>
                </div>
                <Button onClick={() => {
                    setEditing(createDraft());
                    setEditorNonce((value) => value + 1);
                }}>
                    <Plus className="size-4" />
                    新增规则
                </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>规则列表</CardTitle>
                        <CardDescription>不填模型配置 ID 的规则作为全局默认规则。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {(data?.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div>
                                    <div className="font-medium">{item.modelConfigId ? "模型规则" : "全局默认规则"}</div>
                                    <div className="text-muted-foreground text-xs">
                                        基础 {item.baseCost} · 文生图 x{item.textToImageMultiplier} · 图生图 x{item.imageToImageMultiplier}
                                    </div>
                                </div>
                                <div className="flex gap-2">
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
                    </CardContent>
                </Card>
                <BillingEditor
                    key={`${editing?.id || "empty"}-${editorNonce}`}
                    value={editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(undefined)}
                />
            </div>
        </div>
    );
}

function BillingEditor({ value, onSave, onCancel }: { value?: ImageBillingRule; onSave: (data: SaveBillingRuleParams) => void; onCancel: () => void }) {
    const { data: modelConfigs, isLoading: modelConfigsLoading } = useConsoleModelConfigsQuery({ page: 1, pageSize: 100 });
    const models = modelConfigs?.items ?? [];
    const [modelConfigId, setModelConfigId] = useState(value?.modelConfigId ?? "global");
    const [baseCost, setBaseCost] = useState(String(value?.baseCost ?? 1));
    const [textToImageMultiplier, setTextToImageMultiplier] = useState(String(value?.textToImageMultiplier ?? 1));
    const [imageToImageMultiplier, setImageToImageMultiplier] = useState(String(value?.imageToImageMultiplier ?? 1.5));
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [standardQualityMultiplier, setStandardQualityMultiplier] = useState(String(value?.qualityMultipliers?.standard ?? 1));
    const [hdQualityMultiplier, setHdQualityMultiplier] = useState(String(value?.qualityMultipliers?.hd ?? 2));
    const [sizeMultipliersText, setSizeMultipliersText] = useState(formatMultiplierLines(value?.sizeMultipliers ?? {}));
    const [countMultiplierEnabled, setCountMultiplierEnabled] = useState(value?.countMultiplierEnabled ?? true);
    const [refundOnFailure, setRefundOnFailure] = useState(value?.refundOnFailure ?? true);
    const selectedModel = useMemo(
        () => models.find((item) => item.id === modelConfigId),
        [models, modelConfigId],
    );
    const sizeMultipliers = useMemo(() => parseMultiplierLines(sizeMultipliersText), [sizeMultipliersText]);
    const qualityMultipliers = useMemo(() => ({
        standard: Number(standardQualityMultiplier || 1),
        hd: Number(hdQualityMultiplier || 2),
    }), [standardQualityMultiplier, hdQualityMultiplier]);
    const preview = useMemo(() => JSON.stringify({
        modelConfigId: modelConfigId === "global" ? undefined : modelConfigId,
        baseCost: Number(baseCost || 1),
        textToImageMultiplier: Number(textToImageMultiplier || 1),
        imageToImageMultiplier: Number(imageToImageMultiplier || 1.5),
        qualityMultipliers,
        sizeMultipliers,
        countMultiplierEnabled,
        refundOnFailure,
        enabled,
    }, null, 2), [
        modelConfigId,
        baseCost,
        textToImageMultiplier,
        imageToImageMultiplier,
        qualityMultipliers,
        sizeMultipliers,
        countMultiplierEnabled,
        refundOnFailure,
        enabled,
    ]);

    if (!value) return <Card><CardHeader><CardTitle>规则编辑</CardTitle><CardDescription>选择规则或新增。</CardDescription></CardHeader></Card>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>规则编辑</CardTitle>
                <CardDescription>选择绘画模型可覆盖全局默认规则。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>适用模型</Label>
                    <Select value={modelConfigId} onValueChange={setModelConfigId}>
                        <SelectTrigger>
                            <SelectValue placeholder={modelConfigsLoading ? "加载模型中..." : "选择模型"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="global">全局默认规则</SelectItem>
                            {models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    {formatModelName(model)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedModel ? (
                        <div className="text-muted-foreground text-xs">
                            {selectedModel.aiModel?.provider?.name || selectedModel.aiModel?.provider?.provider || "-"} · {selectedModel.aiModel?.model || selectedModel.aiModelId}
                        </div>
                    ) : null}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>基础</Label><Input type="number" value={baseCost} onChange={(e) => setBaseCost(e.target.value)} /></div>
                    <div className="space-y-2"><Label>文生图</Label><Input type="number" value={textToImageMultiplier} onChange={(e) => setTextToImageMultiplier(e.target.value)} /></div>
                    <div className="space-y-2"><Label>图生图</Label><Input type="number" value={imageToImageMultiplier} onChange={(e) => setImageToImageMultiplier(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>标准质量倍率</Label><Input type="number" value={standardQualityMultiplier} onChange={(e) => setStandardQualityMultiplier(e.target.value)} /></div>
                    <div className="space-y-2"><Label>HD 质量倍率</Label><Input type="number" value={hdQualityMultiplier} onChange={(e) => setHdQualityMultiplier(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                    <Label>尺寸倍率</Label>
                    <Textarea
                        className="min-h-24 font-mono text-xs"
                        value={sizeMultipliersText}
                        onChange={(event) => setSizeMultipliersText(event.target.value)}
                        placeholder={"1024x1024=1\n1024x1792=2"}
                    />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={countMultiplierEnabled} onChange={(event) => setCountMultiplierEnabled(event.target.checked)} />
                        按张数累乘
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={refundOnFailure} onChange={(event) => setRefundOnFailure(event.target.checked)} />
                        失败退款
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                        启用
                    </label>
                </div>
                <div className="space-y-2">
                    <Label>规则预览</Label>
                    <Textarea className="min-h-36 font-mono text-xs" value={preview} readOnly />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button onClick={() => {
                        onSave({
                            modelConfigId: modelConfigId === "global" ? undefined : modelConfigId,
                            baseCost: Number(baseCost || 1),
                            textToImageMultiplier: Number(textToImageMultiplier || 1),
                            imageToImageMultiplier: Number(imageToImageMultiplier || 1.5),
                            qualityMultipliers,
                            sizeMultipliers,
                            countMultiplierEnabled,
                            refundOnFailure,
                            enabled,
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

function formatModelName(model: ImageModelConfig) {
    const base = model.displayName || model.aiModel?.name || model.aiModel?.model || model.aiModelId;
    return model.enabled ? base : `${base}（停用）`;
}

function formatMultiplierLines(value: Record<string, number>) {
    return Object.entries(value)
        .map(([key, item]) => `${key}=${item}`)
        .join("\n");
}

function parseMultiplierLines(value: string) {
    return Object.fromEntries(
        value
            .split(/\r?\n|,/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [key, rawValue] = line.split(/[=:]/).map((item) => item.trim());
                return [key, Number(rawValue || 1)];
            })
            .filter(([key, item]) => Boolean(key) && Number.isFinite(item as number)),
    );
}

function createDraft(): ImageBillingRule {
    return {
        id: "",
        baseCost: 1,
        textToImageMultiplier: 1,
        imageToImageMultiplier: 1.5,
        qualityMultipliers: { standard: 1, hd: 2 },
        sizeMultipliers: {},
        countMultiplierEnabled: true,
        refundOnFailure: true,
        enabled: true,
        createdAt: "",
        updatedAt: "",
    };
}
