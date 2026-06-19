import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { SecretReferenceSelect, type SecretReferenceOption } from "@buildingai/ui/components/secret-reference-select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { useSecretsListQuery } from "@buildingai/services/console";
import { CheckCircle2, KeyRound, Plus, Save, SlidersHorizontal, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleBillingRulesQuery,
    useConsoleModelConfigsQuery,
    useCreateBillingRuleMutation,
    useTestModelEndpointMutation,
    useUpdateBillingRuleMutation,
    useUpdateModelConfigMutation,
} from "../../services";
import type { ImageBillingRule, SaveBillingRuleParams } from "../../services/types/billing";
import type {
    ImageModelConfig,
    ImageModelEndpoint,
    SaveModelConfigParams,
    SaveModelEndpointParams,
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
    const { data: secretsData, isLoading: secretsLoading } = useSecretsListQuery({ page: 1, pageSize: 100, status: 1 });
    const updateMutation = useUpdateModelConfigMutation();
    const createBillingMutation = useCreateBillingRuleMutation();
    const updateBillingMutation = useUpdateBillingRuleMutation();
    const testEndpointMutation = useTestModelEndpointMutation({
        onSuccess: (result) => toast.success(result.message || "接入点配置可用"),
        onError: (error) => toast.error(error.message || "测试失败"),
    });
    const items = data?.items ?? [];
    const secretOptions = secretsData?.items ?? [];
    const [selectedId, setSelectedId] = useState<string>();
    const selected = useMemo(
        () => items.find((item) => item.id === selectedId) ?? items[0],
        [items, selectedId],
    );
    const selectedBillingRule = useMemo(
        () => (billingData?.items ?? []).find((item) => item.modelConfigId === selected?.id),
        [billingData?.items, selected?.id],
    );

    useEffect(() => {
        if (!selectedId && items[0]?.id) {
            setSelectedId(items[0].id);
        }
    }, [items, selectedId]);

    const handleSave = async (id: string, form: SaveModelConfigParams, billing?: SaveBillingRuleParams) => {
        try {
            await updateMutation.mutateAsync({ id, data: form });
            if (billing) {
                const payload = { ...billing, modelConfigId: id };
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
                    <p className="text-muted-foreground text-sm">模型目录固定；每个模型绑定一组或多组主站密钥，Base URL 优先从主站密钥读取。</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_520px]">
                <Card>
                    <CardHeader>
                        <CardTitle>固定绘画模型</CardTitle>
                        <CardDescription>用户端只展示启用且用户可见、并绑定可用主站密钥的模型。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="text-muted-foreground text-sm">加载中...</div> : null}
                        {items.map((item) => {
                            const ready = (item.endpoints ?? []).some((endpoint) => endpoint.enabled && endpoint.secretId);
                            return (
                                <Button
                                    key={item.id}
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedId(item.id)}
                                    className={cn(
                                        "flex h-auto w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors",
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
                                            {item.model} · {item.requestContract}
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
                                    {selected?.id === item.id ? <CheckCircle2 className="text-primary size-5 shrink-0" /> : null}
                                </Button>
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
                    billingRule={selectedBillingRule}
                    saving={updateMutation.isPending}
                    testing={testEndpointMutation.isPending}
                    secretsLoading={secretsLoading}
                    secretOptions={secretOptions}
                    onSave={handleSave}
                    onTestEndpoint={(id, endpoint) => testEndpointMutation.mutateAsync({ id, data: serializeEndpoint(endpoint, 0) })}
                />
            </div>
        </div>
    );
}

function ModelOperationsEditor({
    value,
    billingRule,
    saving,
    testing,
    secretsLoading,
    secretOptions,
    onSave,
    onTestEndpoint,
}: {
    value?: ImageModelConfig;
    billingRule?: ImageBillingRule;
    saving: boolean;
    testing: boolean;
    secretsLoading: boolean;
    secretOptions: SecretReferenceOption[];
    onSave: (id: string, data: SaveModelConfigParams, billing?: SaveBillingRuleParams) => void;
    onTestEndpoint: (id: string, data: ImageModelEndpoint) => Promise<unknown>;
}) {
    const [displayName, setDisplayName] = useState("");
    const [description, setDescription] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [visibleToUser, setVisibleToUser] = useState(true);
    const [sortOrder, setSortOrder] = useState("0");
    const [defaultParamsText, setDefaultParamsText] = useState("{}");
    const [allowedParamsText, setAllowedParamsText] = useState("{}");
    const [endpoints, setEndpoints] = useState<ImageModelEndpoint[]>([]);
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
        setSortOrder(String(value?.sortOrder ?? 0));
        setDefaultParamsText(JSON.stringify(value?.defaultParams ?? {}, null, 2));
        setAllowedParamsText(JSON.stringify(value?.allowedParams ?? {}, null, 2));
        setEndpoints((value?.endpoints?.length ? value.endpoints : [makeEndpoint()]).map((endpoint, index) => ({
            ...endpoint,
            id: endpoint.id || `endpoint-${index + 1}`,
        })));
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
                <CardContent className="text-muted-foreground text-sm">模型目录由插件内置。</CardContent>
            </Card>
        );
    }

    const savePayload = (): SaveModelConfigParams => ({
        displayName,
        description,
        enabled,
        visibleToUser,
        sortOrder: Number(sortOrder || 0),
        defaultParams: parseJsonObject(defaultParamsText, "默认参数"),
        allowedParams: parseJsonObject(allowedParamsText, "允许参数"),
        endpoints: endpoints.map((endpoint, index) => serializeEndpoint(endpoint, index)),
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
                <CardDescription>{value.model} · {value.requestContract}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <SwitchField label="启用模型" checked={enabled} onCheckedChange={setEnabled} />
                    <SwitchField label="用户可见" checked={visibleToUser} onCheckedChange={setVisibleToUser} />
                </div>

                <Field label="展示名称" value={displayName} onChange={setDisplayName} />
                <Field label="说明" value={description} onChange={setDescription} />
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

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <Label>接入点</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEndpoints((items) => [...items, makeEndpoint(items.length)])}>
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
                            secretsLoading={secretsLoading}
                            secretOptions={secretOptions}
                            onChange={(next) => setEndpoints((items) => items.map((item, itemIndex) => itemIndex === index ? next : item))}
                            onRemove={() => setEndpoints((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                            onTest={() => onTestEndpoint(value.id, endpoint)}
                        />
                    ))}
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
                            onSave(value.id, savePayload(), billingPayload());
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

function EndpointEditor({
    value,
    canRemove,
    testing,
    secretsLoading,
    secretOptions,
    onChange,
    onRemove,
    onTest,
}: {
    value: ImageModelEndpoint;
    canRemove: boolean;
    testing: boolean;
    secretsLoading: boolean;
    secretOptions: SecretReferenceOption[];
    onChange: (value: ImageModelEndpoint) => void;
    onRemove: () => void;
    onTest: () => void;
}) {
    const patch = (data: Partial<ImageModelEndpoint>) => onChange({ ...value, ...data });
    return (
        <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <KeyRound className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">{value.name || "接入点"}</span>
                    {value.secretId ? <Badge variant="outline">主站密钥</Badge> : null}
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
            <SecretReferenceSelect
                value={value.secretId ?? ""}
                secretName={value.secretName}
                loading={secretsLoading}
                options={secretOptions}
                onChange={(secretId, secretName) => patch({ secretId, secretName })}
            />
            <Field label="密钥名称备注" value={value.secretName ?? ""} placeholder="可选，仅用于页面识别" onChange={(next) => patch({ secretName: next })} />
            <Field label="Base URL 覆盖" value={value.baseUrlOverride ?? ""} placeholder="可选；留空读取主站密钥中的 baseURL/baseUrl/base_url" onChange={(next) => patch({ baseUrlOverride: next })} />
            <div className="grid gap-3 md:grid-cols-4">
                <Field label="请求超时" type="number" value={String(value.requestTimeoutMs ?? 120000)} onChange={(next) => patch({ requestTimeoutMs: Number(next) })} />
                <Field label="测试超时" type="number" value={String(value.testTimeoutMs ?? 15000)} onChange={(next) => patch({ testTimeoutMs: Number(next) })} />
                <Field label="重试次数" type="number" value={String(value.maxRetries ?? 2)} onChange={(next) => patch({ maxRetries: Number(next) })} />
                <Field label="重试延迟" type="number" value={String(value.retryDelayMs ?? 1000)} onChange={(next) => patch({ retryDelayMs: Number(next) })} />
            </div>
            <Button type="button" variant="outline" size="sm" disabled={testing || !value.secretId} onClick={onTest}>
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
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span>{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </label>
    );
}

function makeEndpoint(index = 0): ImageModelEndpoint {
    return {
        id: `endpoint-${index + 1}`,
        name: index === 0 ? "主接口" : `接入点 ${index + 1}`,
        enabled: index === 0,
        priority: 100 - index,
        requestTimeoutMs: 120000,
        testTimeoutMs: 15000,
        maxRetries: 2,
        retryDelayMs: 1000,
    };
}

function serializeEndpoint(endpoint: ImageModelEndpoint, index: number): SaveModelEndpointParams {
    return {
        id: endpoint.id || `endpoint-${index + 1}`,
        name: endpoint.name || `接入点 ${index + 1}`,
        secretId: endpoint.secretId?.trim() || undefined,
        secretName: endpoint.secretName?.trim() || undefined,
        baseUrlOverride: endpoint.baseUrlOverride?.trim() || undefined,
        enabled: endpoint.enabled,
        priority: Number(endpoint.priority ?? 100 - index),
        requestTimeoutMs: Number(endpoint.requestTimeoutMs ?? 120000),
        testTimeoutMs: Number(endpoint.testTimeoutMs ?? 15000),
        maxRetries: Number(endpoint.maxRetries ?? 2),
        retryDelayMs: Number(endpoint.retryDelayMs ?? 1000),
    };
}

function parseJsonObject(value: string, label: string) {
    const parsed = JSON.parse(value || "{}");
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
