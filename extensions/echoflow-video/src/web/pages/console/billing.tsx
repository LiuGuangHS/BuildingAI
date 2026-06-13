import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleVideoBillingRulesQuery,
    useConsoleVideoModelConfigsQuery,
    useCreateVideoBillingRuleMutation,
    useDeleteVideoBillingRuleMutation,
    useUpdateVideoBillingRuleMutation,
} from "../../services";
import type { SaveVideoBillingRuleParams, VideoBillingRule, VideoModelConfig } from "../../services/types/generation";

export default function ConsoleVideoBillingPage() {
    useDocumentHead({ title: "视频计费策略" });
    const { data, isLoading, refetch } = useConsoleVideoBillingRulesQuery({ page: 1, pageSize: 50 });
    const createMutation = useCreateVideoBillingRuleMutation();
    const updateMutation = useUpdateVideoBillingRuleMutation();
    const deleteMutation = useDeleteVideoBillingRuleMutation();
    const [editing, setEditing] = useState<VideoBillingRule | undefined>();
    const [editorNonce, setEditorNonce] = useState(0);

    const handleSave = async (form: SaveVideoBillingRuleParams) => {
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, data: form });
                toast.success("计费规则已更新");
            } else {
                await createMutation.mutateAsync(form);
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
                    <p className="text-muted-foreground text-sm">按模型、时长和分辨率计算算力消耗；失败任务可按规则退款。</p>
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
                        <CardDescription>不选择模型时作为全局默认规则，指定模型后优先使用模型规则。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {(data?.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{item.modelConfig?.displayName || (item.modelConfigId ? "模型规则" : "全局默认规则")}</div>
                                    <div className="text-muted-foreground mt-1 text-xs">
                                        基础 {item.baseCost} · 每秒 {item.perSecondCost} · 最低 {item.minimumCost} · {item.enabled ? "启用" : "停用"}
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
                        {!isLoading && (data?.items ?? []).length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                尚未配置计费规则。未配置时后端会按内置模型倍率估算并扣费。
                            </div>
                        ) : null}
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

function BillingEditor({ value, onSave, onCancel }: { value?: VideoBillingRule; onSave: (data: SaveVideoBillingRuleParams) => void; onCancel: () => void }) {
    const { data: modelConfigs, isLoading: modelConfigsLoading } = useConsoleVideoModelConfigsQuery({ page: 1, pageSize: 100 });
    const models = modelConfigs?.items ?? [];
    const [modelConfigId, setModelConfigId] = useState(value?.modelConfigId ?? "global");
    const [baseCost, setBaseCost] = useState(String(value?.baseCost ?? 0));
    const [perSecondCost, setPerSecondCost] = useState(String(value?.perSecondCost ?? 2));
    const [minimumCost, setMinimumCost] = useState(String(value?.minimumCost ?? 1));
    const [resolutionMultipliersText, setResolutionMultipliersText] = useState(formatMultiplierLines(value?.resolutionMultipliers ?? { "720P": 1, "1080P": 2 }));
    const [refundOnFailure, setRefundOnFailure] = useState(value?.refundOnFailure ?? true);
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const selectedModel = useMemo(() => models.find((item) => item.id === modelConfigId), [models, modelConfigId]);
    const resolutionMultipliers = useMemo(() => parseMultiplierLines(resolutionMultipliersText), [resolutionMultipliersText]);
    const preview = useMemo(() => JSON.stringify({
        modelConfigId: modelConfigId === "global" ? undefined : modelConfigId,
        baseCost: Number(baseCost || 0),
        perSecondCost: Number(perSecondCost || 2),
        resolutionMultipliers,
        minimumCost: Number(minimumCost || 1),
        refundOnFailure,
        enabled,
    }, null, 2), [baseCost, enabled, minimumCost, modelConfigId, perSecondCost, refundOnFailure, resolutionMultipliers]);

    if (!value) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>规则编辑</CardTitle>
                    <CardDescription>选择规则或新增。</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>规则编辑</CardTitle>
                <CardDescription>计算公式：基础费用 + 每秒费用 * 时长 * 分辨率倍率。</CardDescription>
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
                        <div className="text-muted-foreground text-xs">{selectedModel.provider} · {selectedModel.model}</div>
                    ) : null}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>基础费用</Label><Input type="number" value={baseCost} onChange={(event) => setBaseCost(event.target.value)} /></div>
                    <div className="space-y-2"><Label>每秒费用</Label><Input type="number" value={perSecondCost} onChange={(event) => setPerSecondCost(event.target.value)} /></div>
                    <div className="space-y-2"><Label>最低费用</Label><Input type="number" value={minimumCost} onChange={(event) => setMinimumCost(event.target.value)} /></div>
                </div>
                <div className="space-y-2">
                    <Label>分辨率倍率</Label>
                    <Textarea
                        className="min-h-24 font-mono text-xs"
                        value={resolutionMultipliersText}
                        onChange={(event) => setResolutionMultipliersText(event.target.value)}
                        placeholder={"720P=1\n1080P=2"}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                    <Button onClick={() => onSave({
                        modelConfigId: modelConfigId === "global" ? undefined : modelConfigId,
                        baseCost: Number(baseCost || 0),
                        perSecondCost: Number(perSecondCost || 2),
                        resolutionMultipliers,
                        minimumCost: Number(minimumCost || 1),
                        refundOnFailure,
                        enabled,
                    })}>
                        <Save className="size-4" />
                        保存
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function formatModelName(model: VideoModelConfig) {
    const base = model.displayName || model.model;
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

function createDraft(): VideoBillingRule {
    return {
        id: "",
        baseCost: 0,
        perSecondCost: 2,
        resolutionMultipliers: { "720P": 1, "1080P": 2 },
        minimumCost: 1,
        refundOnFailure: true,
        enabled: true,
        createdAt: "",
        updatedAt: "",
    };
}
