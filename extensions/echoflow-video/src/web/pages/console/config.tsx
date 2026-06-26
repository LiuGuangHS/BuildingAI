import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { SecretReferenceSelect } from "@buildingai/ui/components/secret-reference-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { useSecretsListQuery } from "@buildingai/services/console";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsolePage } from "../../components/console-page";
import { ErrorState } from "../../components/error-state";
import {
    useProviderConfigAuditsQuery,
    useProviderConfigQuery,
    usePromptOptimizerModelsQuery,
    useUpdateProviderConfigMutation,
} from "../../services/console";

export default function ProviderConfigPage() {
    useDocumentHead({ title: "视频生成配置" });
    const [webhookSecretId, setWebhookSecretId] = useState("");
    const [webhookSecretName, setWebhookSecretName] = useState("");
    const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
    const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(true);
    const [promptOptimizerModelId, setPromptOptimizerModelId] = useState("");
    const queryClient = useQueryClient();
    const { data, isError, refetch } = useProviderConfigQuery();
    const { data: audits = [] } = useProviderConfigAuditsQuery();
    const { data: promptOptimizerModels = [] } = usePromptOptimizerModelsQuery();
    const { data: secretsData, isLoading: secretsLoading } = useSecretsListQuery({ page: 1, pageSize: 100, status: 1 });
    const secretOptions = secretsData?.items ?? [];
    const updateMutation = useUpdateProviderConfigMutation({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["echoflow-video", "provider-config"] });
            toast.success("配置已保存");
        },
    });
    useEffect(() => {
        if (data) {
            setClearWebhookSecret(false);
            setWebhookSecretId(data.webhookSecretId ?? "");
            setWebhookSecretName(data.webhookSecretName ?? "");
            setPromptOptimizerEnabled(data.promptOptimizerEnabled);
            setPromptOptimizerModelId(data.promptOptimizerModelId ?? "");
        }
    }, [data]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const nextWebhookSecretId = webhookSecretId.trim();
        await updateMutation.mutateAsync({
            webhookSecretId: clearWebhookSecret ? undefined : nextWebhookSecretId || undefined,
            webhookSecretName: clearWebhookSecret ? undefined : webhookSecretName.trim() || undefined,
            clearWebhookSecret,
            promptOptimizerEnabled,
            promptOptimizerModelId: promptOptimizerModelId.trim() || undefined,
            clearPromptOptimizerModelId: !promptOptimizerModelId.trim(),
        });
        setClearWebhookSecret(false);
    };

    if (isError) {
        return (
            <ConsolePage>
                <ErrorState title="加载配置失败" message="无法获取 LLM 与回调配置" onRetry={() => refetch()} />
            </ConsolePage>
        );
    }

    return (
        <ConsolePage>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-3 shadow-sm">管理后台</Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">LLM 与回调</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        视频模型的接入密钥在模型配置页绑定主站 Secret；这里保留主站 LLM 选择、提示词优化和 Webhook。
                    </p>
                </div>
                <Badge variant={data?.promptOptimizerEnabled ? "default" : "secondary"} className="w-fit">
                    {data?.promptOptimizerEnabled ? "提示词优化已启用" : "提示词优化关闭"}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <ShieldCheck className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">模型密钥</p>
                            <p className="text-muted-foreground text-xs">
                                在模型配置页绑定主站 Secret
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <CheckCircle2 className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">优化状态</p>
                            <p className="text-muted-foreground text-xs">{data?.promptOptimizerEnabled ? "允许提示词优化" : "提示词优化关闭"}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <Sparkles className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">主站 LLM</p>
                            <p className="text-muted-foreground text-xs">{data?.promptOptimizerModelId ? "已选择默认优化模型" : "自动选择可用模型"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="max-w-4xl">
                <CardHeader>
                    <CardTitle>LLM 与回调配置</CardTitle>
                    <CardDescription>
                        模型调用密钥复用主站密钥管理；这里仅配置提示词优化和 Webhook。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                            <div className="space-y-2">
                                <SecretReferenceSelect
                                    id="happyhorse-webhook-secret-id"
                                    label="Webhook Secret"
                                    value={webhookSecretId}
                                    secretName={webhookSecretName}
                                    loading={secretsLoading}
                                    options={secretOptions}
                                    emptyLabel="未选择 Webhook Secret"
                                    helperText=""
                                    onChange={(secretId, secretName) => {
                                        setWebhookSecretId(secretId ?? "");
                                        setWebhookSecretName(secretName ?? "");
                                        setClearWebhookSecret(false);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-webhook-secret-name">显示名称</Label>
                                <Input
                                    id="happyhorse-webhook-secret-name"
                                    value={webhookSecretName}
                                    placeholder="可选，用于后台展示"
                                    onChange={(event) => setWebhookSecretName(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                            <div className="text-muted-foreground rounded-md border bg-muted/30 p-3 text-xs">
                                {data?.webhookSecretConfigured
                                    ? `当前引用：${data.webhookSecretName || data.webhookSecretId}`
                                    : "未配置 Webhook Secret；配置后会校验 x-webhook-secret。"}
                            </div>
                            <div className="flex items-end gap-2 pb-2">
                                <Switch
                                    id="happyhorse-clear-webhook"
                                    checked={clearWebhookSecret}
                                    disabled={!data?.webhookSecretConfigured}
                                    onCheckedChange={(checked) => {
                                        setClearWebhookSecret(checked);
                                        if (checked) {
                                            setWebhookSecretId("");
                                            setWebhookSecretName("");
                                        }
                                    }}
                                />
                                <Label htmlFor="happyhorse-clear-webhook" className="cursor-pointer text-sm">
                                    清除回调密钥
                                </Label>
                            </div>
                        </div>

                        <Badge variant={data?.webhookSecretConfigured ? "default" : "secondary"} className="w-fit gap-1">
                            <ShieldCheck className="size-3.5" />
                            {data?.webhookSecretConfigured ? "Webhook 已引用主站 Secret" : "Webhook 未配置密钥"}
                        </Badge>

                        <div className="rounded-md border p-4">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="size-4 text-primary" />
                                        <p className="text-sm font-medium">提示词优化</p>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        生成前调用主站 LLM 优化用户提示词，计费只读取主站模型自身的计费规则。
                                    </p>
                                </div>
                                <Switch
                                    id="prompt-optimizer-enabled"
                                    checked={promptOptimizerEnabled}
                                    onCheckedChange={setPromptOptimizerEnabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prompt-optimizer-model-id">主站 LLM 模型</Label>
                                <Select
                                    value={promptOptimizerModelId || "auto"}
                                    onValueChange={(value) => setPromptOptimizerModelId(value === "auto" ? "" : value)}
                                >
                                    <SelectTrigger id="prompt-optimizer-model-id">
                                        <SelectValue placeholder="自动选择可用 LLM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">自动选择可用 LLM</SelectItem>
                                        {promptOptimizerModels.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.name} · {model.model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="mt-4 space-y-2">
                                <Label>可用主站模型</Label>
                                <div className="text-muted-foreground rounded-md border bg-muted/30 p-3 text-xs">
                                    {promptOptimizerModels.length ? (
                                        promptOptimizerModels.slice(0, 6).map((model) => `${model.name} · ${model.model}`).join(" / ")
                                    ) : (
                                        "暂无可用 LLM，请先在主站模型管理中启用文本模型"
                                    )}
                                </div>
                            </div>
                            <p className="text-muted-foreground mt-4 rounded-md border bg-muted/30 p-3 text-xs">
                                提示词优化不在插件内维护单独价格；所选 LLM 如配置了主站计费规则，会按该规则预检、扣费和失败退款。
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Save className="size-4" />
                                )}
                                保存配置
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="max-w-4xl">
                <CardHeader>
                    <CardTitle>配置审计</CardTitle>
                    <CardDescription>最近的 LLM 与回调配置保存、清除记录，敏感字段已脱敏。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {audits.length === 0 ? (
                        <p className="text-muted-foreground text-sm">暂无审计记录</p>
                    ) : (
                        audits.map((audit) => (
                            <div key={audit.id} className="rounded-md border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{audit.action}</Badge>
                                        {audit.operatorId && <span className="text-muted-foreground text-xs">operator: {audit.operatorId}</span>}
                                    </div>
                                    <span className="text-muted-foreground text-xs">
                                        {new Date(audit.createdAt).toLocaleString("zh-CN")}
                                    </span>
                                </div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                    {JSON.stringify(audit.snapshot, null, 2)}
                                </pre>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </ConsolePage>
    );
}
