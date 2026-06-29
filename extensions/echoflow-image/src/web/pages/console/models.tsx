import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { safeJsonParse } from "@buildingai/stores";
import { CheckCircle2, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleBillingRulesQuery,
    useConsoleLlmModelsQuery,
    useConsoleModelConfigsQuery,
    useCreateBillingRuleMutation,
    useCreateModelConfigMutation,
    useUpdateBillingRuleMutation,
    useUpdateModelConfigMutation,
} from "../../services";
import type { ImageBillingRule, SaveBillingRuleParams } from "../../services/types/billing";
import type {
    ImageModelConfig,
    PromptEnhancerModelOption,
    SaveModelConfigParams,
} from "../../services/types/model-config";

const capabilityLabels: Record<string, string> = {
    textToImage: "文生图",
    imageToImage: "图生图",
    mask: "局部重绘",
    multiReference: "多参考图",
    negativePrompt: "反向提示词",
    seed: "Seed",
    outputFormat: "输出格式",
    background: "背景",
    moderation: "安全等级",
    inputFidelity: "输入保真度",
};

export default function ConsoleModelsPage() {
    useDocumentHead({ title: "绘画模型配置" });
    const { data, isLoading, refetch } = useConsoleModelConfigsQuery({ page: 1, pageSize: 100 });
    const { data: billingData, refetch: refetchBilling } = useConsoleBillingRulesQuery({ page: 1, pageSize: 200 });
    const { data: promptEnhancerModels = [], isLoading: promptEnhancerModelsLoading } = useConsoleLlmModelsQuery();
    const updateMutation = useUpdateModelConfigMutation();
    const createModelMutation = useCreateModelConfigMutation();
    const createBillingMutation = useCreateBillingRuleMutation();
    const updateBillingMutation = useUpdateBillingRuleMutation();
    const items = data?.items ?? [];
    const [selectedId, setSelectedId] = useState<string>();
    const selected = useMemo(
        () => items.find((item) => selectedId ? item.id === selectedId || item.mainModelId === selectedId : false) ?? items[0],
        [items, selectedId],
    );
    const selectedBillingRule = useMemo(
        () => (billingData?.items ?? []).find((item) => item.modelConfigId === selected?.id),
        [billingData?.items, selected?.id],
    );

    useEffect(() => {
        if (!selectedId && (items[0]?.id || items[0]?.mainModelId)) {
            setSelectedId(items[0].id || items[0].mainModelId);
        }
    }, [items, selectedId]);

    const handleSave = async (id: string | undefined, form: SaveModelConfigParams, billing?: SaveBillingRuleParams) => {
        try {
            const savedConfig = id
                ? await updateMutation.mutateAsync({ id, data: form })
                : await createModelMutation.mutateAsync(form);
            const configId = savedConfig.id;
            if (billing && configId) {
                const payload = { ...billing, modelConfigId: configId };
                if (selectedBillingRule?.id) {
                    await updateBillingMutation.mutateAsync({ id: selectedBillingRule.id, data: payload });
                } else {
                    await createBillingMutation.mutateAsync(payload);
                }
            }
            toast.success("模型配置已更新");
            refetch();
            refetchBilling();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">绘画模型配置</h1>
                    <p className="text-muted-foreground text-sm">模型来自主站已启用的文生图模型；插件只配置展示、能力参数和计费。</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_520px]">
                <Card>
                    <CardHeader>
                        <CardTitle>主站绘画模型</CardTitle>
                        <CardDescription>用户端只展示启用且用户可见的插件模型配置。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {items.map((item) => (
                            <Button
                                key={item.mainModelId || item.id}
                                type="button"
                                variant="outline"
                                onClick={() => setSelectedId(item.id || item.mainModelId)}
                                className={cn(
                                    "flex h-auto w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors",
                                    selected?.mainModelId === item.mainModelId ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
                                )}
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate font-medium">{item.displayName}</div>
                                        <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "启用" : "停用"}</Badge>
                                        <Badge variant={item.visibleToUser ? "outline" : "secondary"}>{item.visibleToUser ? "用户可见" : "隐藏"}</Badge>
                                        <Badge variant={item.id ? "default" : "secondary"}>{item.id ? "已配置" : "未配置"}</Badge>
                                    </div>
                                    <div className="text-muted-foreground mt-1 truncate text-xs">
                                        {item.providerName ? `${item.providerName} · ` : ""}{item.model}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {Object.entries(item.capabilities ?? {})
                                            .filter(([, enabled]) => enabled)
                                            .slice(0, 5)
                                            .map(([key]) => (
                                                <Badge key={key} variant="secondary">{capabilityLabels[key] ?? key}</Badge>
                                            ))}
                                    </div>
                                </div>
                                {selected?.mainModelId === item.mainModelId ? <CheckCircle2 className="text-primary size-5 shrink-0" /> : null}
                            </Button>
                        ))}
                        {!isLoading && items.length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                暂无主站文生图模型，请先在主后台启用 text-to-image 模型。
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <ModelOperationsEditor
                    value={selected}
                    billingRule={selectedBillingRule}
                    saving={updateMutation.isPending || createModelMutation.isPending}
                    promptEnhancerModels={promptEnhancerModels}
                    promptEnhancerModelsLoading={promptEnhancerModelsLoading}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}

function ModelOperationsEditor({
    value,
    billingRule,
    saving,
    promptEnhancerModels,
    promptEnhancerModelsLoading,
    onSave,
}: {
    value?: ImageModelConfig;
    billingRule?: ImageBillingRule;
    saving: boolean;
    promptEnhancerModels: PromptEnhancerModelOption[];
    promptEnhancerModelsLoading: boolean;
    onSave: (id: string | undefined, data: SaveModelConfigParams, billing?: SaveBillingRuleParams) => void;
}) {
    const [displayName, setDisplayName] = useState("");
    const [description, setDescription] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [visibleToUser, setVisibleToUser] = useState(true);
    const [promptEnhancerModelId, setPromptEnhancerModelId] = useState("");
    const [sortOrder, setSortOrder] = useState("0");
    const [defaultParamsText, setDefaultParamsText] = useState("{}");
    const [allowedParamsText, setAllowedParamsText] = useState("{}");
    const [baseCost, setBaseCost] = useState("1");
    const [textToImageMultiplier, setTextToImageMultiplier] = useState("1");
    const [imageToImageMultiplier, setImageToImageMultiplier] = useState("1.5");
    const [standardQualityMultiplier, setStandardQualityMultiplier] = useState("1");
    const [hdQualityMultiplier, setHdQualityMultiplier] = useState("2");
    const [sizeMultipliersText, setSizeMultipliersText] = useState("");
    const [countMultiplierEnabled, setCountMultiplierEnabled] = useState(true);
    const [refundOnFailure, setRefundOnFailure] = useState(true);
    const [billingEnabled, setBillingEnabled] = useState(true);

    useEffect(() => {
        setDisplayName(value?.displayName ?? "");
        setDescription(value?.description ?? "");
        setEnabled(value?.enabled ?? true);
        setVisibleToUser(value?.visibleToUser ?? true);
        setPromptEnhancerModelId(value?.promptEnhancerModelId ?? "");
        setSortOrder(String(value?.sortOrder ?? 0));
        setDefaultParamsText(JSON.stringify(value?.defaultParams ?? {}, null, 2));
        setAllowedParamsText(JSON.stringify(value?.allowedParams ?? {}, null, 2));
        setBaseCost(String(billingRule?.baseCost ?? 1));
        setTextToImageMultiplier(String(billingRule?.textToImageMultiplier ?? 1));
        setImageToImageMultiplier(String(billingRule?.imageToImageMultiplier ?? 1.5));
        setStandardQualityMultiplier(String(billingRule?.qualityMultipliers?.standard ?? 1));
        setHdQualityMultiplier(String(billingRule?.qualityMultipliers?.hd ?? 2));
        setSizeMultipliersText(formatMultiplierLines(billingRule?.sizeMultipliers ?? {}));
        setCountMultiplierEnabled(billingRule?.countMultiplierEnabled ?? true);
        setRefundOnFailure(billingRule?.refundOnFailure ?? true);
        setBillingEnabled(billingRule?.enabled ?? true);
    }, [value, billingRule]);

    if (!value) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>模型配置</CardTitle>
                    <CardDescription>选择左侧模型后调整。</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">模型来自主站文生图模型。</CardContent>
            </Card>
        );
    }

    const savePayload = (): SaveModelConfigParams => ({
        mainModelId: value.mainModelId,
        displayName,
        description,
        promptEnhancerModelId: promptEnhancerModelId || null,
        enabled,
        visibleToUser,
        sortOrder: Number(sortOrder || 0),
        defaultParams: parseJsonObject(defaultParamsText, "默认参数"),
        allowedParams: parseJsonObject(allowedParamsText, "允许参数"),
    });
    const billingPayload = (): SaveBillingRuleParams => ({
        baseCost: Number(baseCost || 1),
        textToImageMultiplier: Number(textToImageMultiplier || 1),
        imageToImageMultiplier: Number(imageToImageMultiplier || 1.5),
        qualityMultipliers: {
            standard: Number(standardQualityMultiplier || 1),
            hd: Number(hdQualityMultiplier || 2),
        },
        sizeMultipliers: parseMultiplierLines(sizeMultipliersText),
        countMultiplierEnabled,
        refundOnFailure,
        enabled: billingEnabled,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="size-5" />
                    模型配置
                </CardTitle>
                <CardDescription>{value.providerName ? `${value.providerName} · ` : ""}{value.model}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <SwitchField label="启用模型" checked={enabled} onCheckedChange={setEnabled} />
                    <SwitchField label="用户可见" checked={visibleToUser} onCheckedChange={setVisibleToUser} />
                </div>

                <Field label="展示名称" value={displayName} onChange={setDisplayName} />
                <Field label="说明" value={description} onChange={setDescription} />
                <div className="space-y-2">
                    <Label>提示词润色模型</Label>
                    <Select
                        value={promptEnhancerModelId || "__none__"}
                        onValueChange={(next) => setPromptEnhancerModelId(next === "__none__" ? "" : next)}
                        disabled={promptEnhancerModelsLoading}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={promptEnhancerModelsLoading ? "加载主站 LLM 中..." : "选择主站 LLM"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">未配置</SelectItem>
                            {promptEnhancerModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate">{model.providerName} / {model.name}</span>
                                        <span className="truncate text-xs text-muted-foreground">{model.model}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!promptEnhancerModelsLoading && promptEnhancerModels.length === 0 ? (
                        <p className="text-muted-foreground text-xs">请先在主后台启用 LLM 模型。</p>
                    ) : null}
                </div>
                <Field label="排序" type="number" value={sortOrder} onChange={setSortOrder} />

                <div className="space-y-2">
                    <Label>固定能力</Label>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(value.capabilities ?? {})
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                                <Badge key={key} variant="secondary">{capabilityLabels[key] ?? key}</Badge>
                            ))}
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <JsonField label="默认参数" value={defaultParamsText} onChange={setDefaultParamsText} />
                    <JsonField label="允许参数" value={allowedParamsText} onChange={setAllowedParamsText} />
                </div>

                <div className="space-y-3 rounded-md border p-3">
                    <div>
                        <Label>计费设置</Label>
                        <p className="text-muted-foreground mt-1 text-xs">按当前绘画模型配置覆盖全局计费规则。</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="基础费用" type="number" value={baseCost} onChange={setBaseCost} />
                        <Field label="文生图倍率" type="number" value={textToImageMultiplier} onChange={setTextToImageMultiplier} />
                        <Field label="图生图倍率" type="number" value={imageToImageMultiplier} onChange={setImageToImageMultiplier} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="标准质量倍率" type="number" value={standardQualityMultiplier} onChange={setStandardQualityMultiplier} />
                        <Field label="HD 质量倍率" type="number" value={hdQualityMultiplier} onChange={setHdQualityMultiplier} />
                    </div>
                    <div className="space-y-2">
                        <Label>尺寸倍率</Label>
                        <Textarea
                            className="min-h-20 font-mono text-xs"
                            value={sizeMultipliersText}
                            onChange={(event) => setSizeMultipliersText(event.target.value)}
                            placeholder={"1024x1024=1\n1536x1024=1.5"}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <SwitchField label="按张数累乘" checked={countMultiplierEnabled} onCheckedChange={setCountMultiplierEnabled} />
                        <SwitchField label="失败退款" checked={refundOnFailure} onCheckedChange={setRefundOnFailure} />
                        <SwitchField label="启用计费规则" checked={billingEnabled} onCheckedChange={setBillingEnabled} />
                    </div>
                </div>

                <Button
                    className="w-full"
                    disabled={saving}
                    onClick={() => {
                        try {
                            if (!displayName.trim()) {
                                toast.error("展示名称不能为空");
                                return;
                            }
                            onSave(value.id || undefined, savePayload(), billingPayload());
                        } catch (error) {
                            toast.error(error instanceof Error ? error.message : "配置格式不正确");
                        }
                    }}
                >
                    <Save className="size-4" />
                    {saving ? "保存中..." : "保存配置"}
                </Button>
            </CardContent>
        </Card>
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

function JsonField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Textarea className="min-h-40 font-mono text-xs" value={value} onChange={(event) => onChange(event.target.value)} />
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
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <Label>{label}</Label>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

function parseJsonObject(value: string, label: string) {
    const parsed = safeJsonParse<unknown>(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${label}必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
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
