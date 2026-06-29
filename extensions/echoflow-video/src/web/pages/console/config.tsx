import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
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
    const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(true);
    const [promptOptimizerModelId, setPromptOptimizerModelId] = useState("");
    const queryClient = useQueryClient();
    const { data, isError, refetch } = useProviderConfigQuery();
    const { data: audits = [] } = useProviderConfigAuditsQuery();
    const { data: promptOptimizerModels = [] } = usePromptOptimizerModelsQuery();
    const updateMutation = useUpdateProviderConfigMutation({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["echoflow-video", "provider-config"] });
            toast.success("配置已保存");
        },
    });

    useEffect(() => {
        if (data) {
            setPromptOptimizerEnabled(data.promptOptimizerEnabled);
            setPromptOptimizerModelId(data.promptOptimizerModelId ?? "");
        }
    }, [data]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await updateMutation.mutateAsync({
            promptOptimizerEnabled,
            promptOptimizerModelId: promptOptimizerModelId.trim() || undefined,
            clearPromptOptimizerModelId: !promptOptimizerModelId.trim(),
        });
    };

    if (isError) {
        return (
            <ConsolePage>
                <ErrorState title="加载配置失败" message="无法获取 LLM 配置" onRetry={() => refetch()} />
            </ConsolePage>
        );
    }

    return (
        <ConsolePage>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-3 shadow-sm">管理后台</Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">LLM 配置</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        视频模型密钥在主站供应商中配置；这里仅配置提示词优化。
                    </p>
                </div>
                <Badge variant={data?.promptOptimizerEnabled ? "default" : "secondary"} className="w-fit">
                    {data?.promptOptimizerEnabled ? "提示词优化已启用" : "提示词优化关闭"}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <CheckCircle2 className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">模型密钥</p>
                            <p className="text-muted-foreground text-xs">复用主站 AiProvider 绑定的 Secret</p>
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
                    <CardTitle>提示词优化</CardTitle>
                    <CardDescription>生成前可调用主站 LLM 优化用户提示词。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="rounded-md border p-4">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="size-4 text-primary" />
                                        <p className="text-sm font-medium">提示词优化</p>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        计费读取主站模型自身的计费规则。
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
                            <p className="text-muted-foreground mt-4 rounded-md border bg-muted/30 p-3 text-xs">
                                提示词优化不在插件内维护单独价格；所选 LLM 如配置了主站计费规则，会按该规则预检、扣费和失败退款。
                            </p>
                        </div>

                        <Button type="submit" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            保存配置
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="max-w-4xl">
                <CardHeader>
                    <CardTitle>配置审计</CardTitle>
                    <CardDescription>最近的 LLM 配置保存、清除记录。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {audits.map((audit) => (
                        <div key={audit.id} className="rounded-lg border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{audit.action}</span>
                                <span className="text-muted-foreground text-xs">{new Date(audit.createdAt).toLocaleString("zh-CN")}</span>
                            </div>
                        </div>
                    ))}
                    {!audits.length ? <p className="text-muted-foreground text-sm">暂无审计记录。</p> : null}
                </CardContent>
            </Card>
        </ConsolePage>
    );
}
