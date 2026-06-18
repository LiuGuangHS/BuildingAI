import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { CheckCircle2, KeyRound, Loader2, PlugZap, RotateCcw, Save, ServerCog, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "../../components/error-state";
import {
    queryClient,
    useClearProviderConfigMutation,
    useProviderConfigAuditsQuery,
    useProviderConfigQuery,
    useTestProviderConfigMutation,
    useUpdateProviderConfigMutation,
} from "../../services";

export default function ProviderConfigPage() {
    useDocumentHead({ title: "AI视频工作台配置" });
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("https://api.echoflow.cn");
    const [requestTimeoutMs, setRequestTimeoutMs] = useState(120000);
    const [testTimeoutMs, setTestTimeoutMs] = useState(15000);
    const [maxRetries, setMaxRetries] = useState(2);
    const [retryDelayMs, setRetryDelayMs] = useState(1000);
    const [webhookSecret, setWebhookSecret] = useState("");
    const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
    const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(true);
    const [promptOptimizerModelId, setPromptOptimizerModelId] = useState("");
    const [promptOptimizerAllowedModelIds, setPromptOptimizerAllowedModelIds] = useState("");
    const [promptOptimizerBillingEnabled, setPromptOptimizerBillingEnabled] = useState(true);
    const [promptOptimizerBillingPower, setPromptOptimizerBillingPower] = useState(1);
    const [promptOptimizerBillingTokens, setPromptOptimizerBillingTokens] = useState(1000);
    const [promptOptimizerEstimatedTokens, setPromptOptimizerEstimatedTokens] = useState(500);
    const [enabled, setEnabled] = useState(true);
    const { data, isLoading, isError, refetch } = useProviderConfigQuery();
    const { data: audits = [] } = useProviderConfigAuditsQuery();
    const updateMutation = useUpdateProviderConfigMutation({
        onSuccess: () => {
            setApiKey("");
            queryClient.invalidateQueries({ queryKey: ["echoflow-video", "provider-config"] });
            toast.success("配置已保存");
        },
    });
    const testMutation = useTestProviderConfigMutation({
        onSuccess: (result) => toast.success(result.message || "配置可用"),
        onError: (error) => toast.error(error.message || "连接测试失败"),
    });
    const clearMutation = useClearProviderConfigMutation({
        onSuccess: () => {
            setApiKey("");
            queryClient.invalidateQueries({ queryKey: ["echoflow-video", "provider-config"] });
            toast.success("配置已清除");
        },
    });

    useEffect(() => {
        if (data) {
            setEnabled(data.enabled);
            setBaseUrl(data.baseUrl);
            setRequestTimeoutMs(data.requestTimeoutMs);
            setTestTimeoutMs(data.testTimeoutMs);
            setMaxRetries(data.maxRetries);
            setRetryDelayMs(data.retryDelayMs);
            setClearWebhookSecret(false);
            setPromptOptimizerEnabled(data.promptOptimizerEnabled);
            setPromptOptimizerModelId(data.promptOptimizerModelId ?? "");
            setPromptOptimizerAllowedModelIds((data.promptOptimizerAllowedModelIds ?? []).join("\n"));
            setPromptOptimizerBillingEnabled(data.promptOptimizerBillingEnabled ?? true);
            setPromptOptimizerBillingPower(data.promptOptimizerBillingPower ?? 1);
            setPromptOptimizerBillingTokens(data.promptOptimizerBillingTokens ?? 1000);
            setPromptOptimizerEstimatedTokens(data.promptOptimizerEstimatedTokens ?? 500);
        }
    }, [data]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!apiKey.trim() && !data?.configured) {
            toast.error("请输入兼容接口 API Key，或到模型配置页为模型接入点配置密钥");
            return;
        }
        await updateMutation.mutateAsync({
            apiKey: apiKey.trim() || undefined,
            baseUrl: baseUrl.trim(),
            requestTimeoutMs,
            testTimeoutMs,
            maxRetries,
            retryDelayMs,
            webhookSecret: webhookSecret.trim() || undefined,
            clearWebhookSecret,
            promptOptimizerEnabled,
            promptOptimizerModelId: promptOptimizerModelId.trim() || undefined,
            clearPromptOptimizerModelId: !promptOptimizerModelId.trim(),
            promptOptimizerAllowedModelIds: parseModelIds(promptOptimizerAllowedModelIds),
            promptOptimizerBillingEnabled,
            promptOptimizerBillingPower,
            promptOptimizerBillingTokens,
            promptOptimizerEstimatedTokens,
            enabled,
        });
        setWebhookSecret("");
        setClearWebhookSecret(false);
    };

    const handleTest = async () => {
        await testMutation.mutateAsync({
            apiKey: apiKey.trim() || undefined,
            baseUrl: baseUrl.trim(),
            requestTimeoutMs,
            testTimeoutMs,
            maxRetries,
            retryDelayMs,
        });
    };

    const handleResetRuntime = () => {
        setBaseUrl("https://api.echoflow.cn");
        setRequestTimeoutMs(120000);
        setTestTimeoutMs(15000);
        setMaxRetries(2);
        setRetryDelayMs(1000);
    };

    if (isError) {
        return (
            <div className="min-h-screen p-4 md:p-6">
                <ErrorState title="加载配置失败" message="无法获取优化配置" onRetry={() => refetch()} />
            </div>
        );
    }

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-3 shadow-sm">管理后台</Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">优化配置</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        视频模型的 Base URL / API Key 在模型配置页维护；这里保留提示词优化、Webhook 和旧兼容配置。
                    </p>
                </div>
                <Badge variant={data?.configured && data.enabled ? "default" : "secondary"} className="w-fit">
                    {data?.configured ? (data.enabled ? "已启用" : "已配置，未启用") : "未配置"}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <KeyRound className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">兼容密钥</p>
                            <p className="text-muted-foreground text-xs">
                                {isLoading ? "加载中" : data?.configured ? data.apiKeyMasked : "未配置"}
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
                        <ServerCog className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">旧兼容地址</p>
                            <p className="text-muted-foreground text-xs">{data?.baseUrl ?? "https://api.echoflow.cn"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="max-w-4xl">
                <CardHeader>
                    <CardTitle>兼容配置</CardTitle>
                    <CardDescription>
                        新视频模型优先读取模型配置页的接入点；这里的密钥仅保留给旧回调和兼容测试。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-api-key">API Key</Label>
                                <Input
                                    id="happyhorse-api-key"
                                    type="password"
                                    autoComplete="new-password"
                                    value={apiKey}
                                    placeholder={data?.configured ? "输入新密钥以替换当前配置" : "输入兼容接口 API Key"}
                                    onChange={(event) => setApiKey(event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-base-url">Base URL</Label>
                                <Input
                                    id="happyhorse-base-url"
                                    value={baseUrl}
                                    onChange={(event) => setBaseUrl(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-request-timeout">请求超时 ms</Label>
                                <Input
                                    id="happyhorse-request-timeout"
                                    type="number"
                                    min={3000}
                                    max={300000}
                                    step={1000}
                                    value={requestTimeoutMs}
                                    onChange={(event) => setRequestTimeoutMs(Number(event.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-test-timeout">测试超时 ms</Label>
                                <Input
                                    id="happyhorse-test-timeout"
                                    type="number"
                                    min={3000}
                                    max={60000}
                                    step={1000}
                                    value={testTimeoutMs}
                                    onChange={(event) => setTestTimeoutMs(Number(event.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-max-retries">重试次数</Label>
                                <Input
                                    id="happyhorse-max-retries"
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={maxRetries}
                                    onChange={(event) => setMaxRetries(Number(event.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-retry-delay">重试延迟 ms</Label>
                                <Input
                                    id="happyhorse-retry-delay"
                                    type="number"
                                    min={100}
                                    max={10000}
                                    step={100}
                                    value={retryDelayMs}
                                    onChange={(event) => setRetryDelayMs(Number(event.target.value))}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                            <div className="space-y-2">
                                <Label htmlFor="happyhorse-webhook-secret">Webhook Secret</Label>
                                <Input
                                    id="happyhorse-webhook-secret"
                                    type="password"
                                    autoComplete="new-password"
                                    value={webhookSecret}
                                    placeholder={
                                        data?.webhookSecretConfigured
                                            ? `已配置 ${data.webhookSecretMasked}`
                                            : "可选，配置后校验 x-webhook-secret"
                                    }
                                    onChange={(event) => {
                                        setWebhookSecret(event.target.value);
                                        if (event.target.value.trim()) {
                                            setClearWebhookSecret(false);
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex items-end gap-2 pb-2">
                                <Switch
                                    id="happyhorse-clear-webhook"
                                    checked={clearWebhookSecret}
                                    disabled={!data?.webhookSecretConfigured}
                                    onCheckedChange={(checked) => {
                                        setClearWebhookSecret(checked);
                                        if (checked) setWebhookSecret("");
                                    }}
                                />
                                <Label htmlFor="happyhorse-clear-webhook" className="cursor-pointer text-sm">
                                    清除回调密钥
                                </Label>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="happyhorse-enabled" checked={enabled} onCheckedChange={setEnabled} />
                                <Label htmlFor="happyhorse-enabled" className="cursor-pointer">
                                    启用兼容配置
                                </Label>
                            </div>
                            <Badge variant={data?.webhookSecretConfigured ? "default" : "secondary"} className="gap-1">
                                <ShieldCheck className="size-3.5" />
                                {data?.webhookSecretConfigured ? "Webhook 已加密配置" : "Webhook 未配置密钥"}
                            </Badge>
                        </div>

                        <div className="rounded-md border p-4">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="size-4 text-primary" />
                                        <p className="text-sm font-medium">提示词优化</p>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        生成前优化用户提示词；默认模型与模型池会开放给用户选择，扣费优先按主站模型计费规则计算 token。
                                    </p>
                                </div>
                                <Switch
                                    id="prompt-optimizer-enabled"
                                    checked={promptOptimizerEnabled}
                                    onCheckedChange={setPromptOptimizerEnabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prompt-optimizer-model-id">主站 AI 模型 ID</Label>
                                <Input
                                    id="prompt-optimizer-model-id"
                                    value={promptOptimizerModelId}
                                    placeholder="默认优化模型，留空使用本地规则"
                                    onChange={(event) => setPromptOptimizerModelId(event.target.value)}
                                />
                            </div>
                            <div className="mt-4 space-y-2">
                                <Label htmlFor="prompt-optimizer-allowed-models">允许用户选择的模型 ID</Label>
                                <Textarea
                                    id="prompt-optimizer-allowed-models"
                                    rows={4}
                                    value={promptOptimizerAllowedModelIds}
                                    placeholder="每行一个主站 AI 模型 ID；默认模型会自动加入可选列表"
                                    onChange={(event) => setPromptOptimizerAllowedModelIds(event.target.value)}
                                />
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="prompt-optimizer-billing-enabled"
                                        checked={promptOptimizerBillingEnabled}
                                        onCheckedChange={setPromptOptimizerBillingEnabled}
                                    />
                                    <Label htmlFor="prompt-optimizer-billing-enabled" className="cursor-pointer">
                                        按 token 计费
                                    </Label>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="prompt-optimizer-billing-power">兜底算力</Label>
                                    <Input
                                        id="prompt-optimizer-billing-power"
                                        type="number"
                                        min={1}
                                        value={promptOptimizerBillingPower}
                                        onChange={(event) => setPromptOptimizerBillingPower(Number(event.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="prompt-optimizer-billing-tokens">兜底 tokens</Label>
                                    <Input
                                        id="prompt-optimizer-billing-tokens"
                                        type="number"
                                        min={1}
                                        value={promptOptimizerBillingTokens}
                                        onChange={(event) => setPromptOptimizerBillingTokens(Number(event.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="prompt-optimizer-estimated-tokens">预检 tokens</Label>
                                    <Input
                                        id="prompt-optimizer-estimated-tokens"
                                        type="number"
                                        min={50}
                                        value={promptOptimizerEstimatedTokens}
                                        onChange={(event) => setPromptOptimizerEstimatedTokens(Number(event.target.value))}
                                    />
                                </div>
                            </div>
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
                            <Button
                                type="button"
                                variant="outline"
                                disabled={testMutation.isPending || (!apiKey.trim() && !data?.configured)}
                                onClick={handleTest}
                            >
                                {testMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <PlugZap className="size-4" />
                                )}
                                测试连接
                            </Button>
                            <Button type="button" variant="outline" onClick={handleResetRuntime}>
                                <RotateCcw className="size-4" />
                                恢复默认
                            </Button>
                            {data?.configured && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={clearMutation.isPending}
                                    onClick={() => clearMutation.mutate()}
                                >
                                    {clearMutation.isPending ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="size-4" />
                                    )}
                                    清除密钥
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="max-w-4xl">
                <CardHeader>
                    <CardTitle>配置审计</CardTitle>
                    <CardDescription>最近的优化配置保存、清除记录，敏感字段已脱敏。</CardDescription>
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
        </div>
    );
}

function parseModelIds(value: string): string[] {
    return Array.from(
        new Set(
            value
                .split(/[\n,，\s]+/)
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    );
}
