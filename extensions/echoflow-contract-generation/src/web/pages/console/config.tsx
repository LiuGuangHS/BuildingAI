import { useEffect, useMemo, useState } from "react";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";

import { useAdminContractGenerationConfigQuery, useAdminLlmModelsQuery, useUpdateAdminContractGenerationConfigMutation } from "../../services/console";

export default function ContractGenerationConfigPage() {
    const { data: config } = useAdminContractGenerationConfigQuery();
    const { data: models = [], isLoading } = useAdminLlmModelsQuery();
    const updateMutation = useUpdateAdminContractGenerationConfigMutation();
    const [modelId, setModelId] = useState("");
    const [message, setMessage] = useState("");
    const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [modelId, models]);
    const currentModel = selectedModel ?? config?.model ?? null;
    const selectValue = modelId || "__none__";

    useEffect(() => {
        if (config?.modelId) setModelId(config.modelId);
    }, [config?.modelId]);

    async function handleSave() {
        if (!modelId) {
            setMessage("请选择一个启用的 LLM 模型");
            return;
        }
        try {
            await updateMutation.mutateAsync({ modelId });
            setMessage("固定模型已保存");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    return (
        <main className="ec-console-page">
            <header className="ec-console-header">
                <div>
                    <p className="ec-console-kicker">AI 合同管理</p>
                    <h1>模型配置</h1>
                    <p>固定用户端合同生成、上传审查和条款优化使用的 LLM 模型。</p>
                </div>
                <Badge variant={config?.configured ? "default" : "outline"}>{config?.configured ? "已配置" : "未配置"}</Badge>
            </header>

            <section className="ec-config-layout">
                <Card>
                    <CardHeader>
                        <CardTitle>固定生成模型</CardTitle>
                        <CardDescription>只展示已启用 Provider 下的 LLM 模型，保存时后端会再次校验。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">

                        <div className="grid gap-2">
                            <Label htmlFor="contract-generation-model-id">生成模型</Label>
                            <Select value={selectValue} onValueChange={(value) => setModelId(value === "__none__" ? "" : value)} disabled={isLoading}>
                                <SelectTrigger id="contract-generation-model-id">
                                    <SelectValue placeholder={isLoading ? "模型加载中..." : "请选择固定模型"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">{isLoading ? "模型加载中..." : "请选择固定模型"}</SelectItem>
                                    {models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.providerName} / {model.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {currentModel && (
                            <div className="rounded-md border p-4">
                                <div className="grid gap-2">
                                    <span className="text-sm text-muted-foreground">当前选择</span>
                                    <strong className="text-sm">{currentModel.providerName} / {currentModel.name}</strong>
                                </div>
                                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                    <div><dt className="text-muted-foreground">Provider</dt><dd>{currentModel.provider}</dd></div>
                                    <div><dt className="text-muted-foreground">合同单价</dt><dd>{formatCredits(currentModel.pricePerContract)}</dd></div>
                                </dl>
                            </div>
                        )}

                        {models.length === 0 && !isLoading ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">暂无可用 LLM 模型，请先在主后台启用 Provider 和模型。</div> : null}
                        {message ? <div className={`rounded-md border p-3 text-sm ${message.includes("失败") ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-foreground"}`}>{message}</div> : null}

                        <div className="flex items-center gap-3">
                            <Button onClick={handleSave} disabled={!modelId || updateMutation.isPending} loading={updateMutation.isPending}>
                                保存配置
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>运行状态</CardTitle>
                        <CardDescription>用户端不暴露模型选择，会自动使用这里保存的固定模型。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <dl className="ec-detail-list">
                            <div><dt>配置状态</dt><dd>{config?.configured ? "可用" : "待配置"}</dd></div>
                            <div><dt>当前模型</dt><dd>{config?.model ? `${config.model.providerName} / ${config.model.name}` : "-"}</dd></div>
                            <div><dt>模型 ID</dt><dd className="ec-mono">{config?.modelId || "-"}</dd></div>
                            <div><dt>合同单价</dt><dd>{formatCredits(config?.model?.pricePerContract)}</dd></div>
                            <div><dt>可选模型</dt><dd>{models.length} 个</dd></div>
                        </dl>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}

function formatCredits(value?: number) {
    if (!value) return "0 积分";
    return `${value} 积分`;
}
