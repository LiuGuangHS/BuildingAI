import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@buildingai/ui/components/ui/table";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";

import { getTownAiConfig, getTownAiLogs, listTownAiModels, testTownAi, updateTownAiConfig } from "../../services/console/town";
import type { TownAiConfig } from "../../services/types";

const defaultConfig: TownAiConfig = {
    enabled: false,
    defaultModelId: null,
    temperature: 0.8,
    maxTokens: 1200,
    fallbackToRules: true,
    dailyLimitPerUser: 100,
    adviceCostPower: 0,
    chatCostPower: 0,
    eventCostPower: 0,
};

export default function TownAiConfigPage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<TownAiConfig>(defaultConfig);
    const [testPrompt, setTestPrompt] = useState("请用一句话给今天的小镇经营建议。 ");
    const [testResult, setTestResult] = useState("");
    const [message, setMessage] = useState("");
    const [logFilters, setLogFilters] = useState({ type: "", success: "", fallbackUsed: "", saveId: "" });

    const configQuery = useQuery({ queryKey: ["town-ai-config"], queryFn: getTownAiConfig });
    const modelsQuery = useQuery({ queryKey: ["town-ai-models"], queryFn: listTownAiModels });
    const logsQuery = useQuery({
        queryKey: ["town-ai-logs", logFilters],
        queryFn: () => getTownAiLogs({
            type: logFilters.type || undefined,
            success: logFilters.success ? logFilters.success === "true" : undefined,
            fallbackUsed: logFilters.fallbackUsed ? logFilters.fallbackUsed === "true" : undefined,
            saveId: logFilters.saveId.trim() || undefined,
        }),
    });
    const modelSelectValue = form.defaultModelId ?? "__none__";
    const typeFilterValue = logFilters.type || "__all__";
    const successFilterValue = logFilters.success || "__all__";
    const fallbackFilterValue = logFilters.fallbackUsed || "__all__";

    useEffect(() => {
        if (configQuery.data) {
            setForm({ ...defaultConfig, ...configQuery.data });
        }
    }, [configQuery.data]);

    const saveMutation = useMutation({
        mutationFn: () => updateTownAiConfig(form),
        onSuccess: (result) => {
            setForm({ ...defaultConfig, ...result });
            setMessage("AI 配置已保存");
            void queryClient.invalidateQueries({ queryKey: ["town-ai-config"] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "保存失败"),
    });

    const testMutation = useMutation({
        mutationFn: () => testTownAi(testPrompt),
        onSuccess: (result) => {
            setTestResult(result.text);
            void queryClient.invalidateQueries({ queryKey: ["town-ai-logs"] });
        },
        onError: (error) => setTestResult(error instanceof Error ? error.message : "测试失败"),
    });

    return (
        <main className="town-console ai-config-page">
            <div className="console-section-header">
                <div>
                    <h1>AI 配置</h1>
                    <p className="console-muted">管理员统一指定模型。用户侧不暴露模型选择，只提示参谋安排和居民回应可能消耗额度；实际计费由平台和模型配置决定。</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        void configQuery.refetch();
                        void modelsQuery.refetch();
                        void logsQuery.refetch();
                    }}
                >
                    刷新数据
                </Button>
            </div>

            <section className="ai-config-grid">
                <Card className="config-card">
                    <CardHeader>
                        <CardTitle>模型设置</CardTitle>
                        <CardDescription>配置小镇 AI 的默认模型、响应长度和降级策略。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium">启用 AI</p>
                                <p className="text-muted-foreground text-sm">关闭后将只走本地规则。</p>
                            </div>
                            <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>默认模型</Label>
                            <Select value={modelSelectValue} onValueChange={(value) => setForm({ ...form, defaultModelId: value === "__none__" ? null : value })}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="未选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">未选择模型</SelectItem>
                                    {modelsQuery.data?.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.providerName} / {model.name} ({model.model})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>温度</Label>
                                <Input
                                    max={2}
                                    min={0}
                                    step={0.1}
                                    type="number"
                                    value={form.temperature}
                                    onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>最大输出 tokens</Label>
                                <Input
                                    max={4000}
                                    min={200}
                                    step={100}
                                    type="number"
                                    value={form.maxTokens}
                                    onChange={(event) => setForm({ ...form, maxTokens: Number(event.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium">失败时降级本地规则</p>
                                <p className="text-muted-foreground text-sm">模型异常时自动切回规则引擎。</p>
                            </div>
                            <Switch checked={form.fallbackToRules} onCheckedChange={(checked) => setForm({ ...form, fallbackToRules: checked })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>每用户每日调用上限</Label>
                            <Input
                                min={0}
                                step={10}
                                type="number"
                                value={form.dailyLimitPerUser}
                                onChange={(event) => setForm({ ...form, dailyLimitPerUser: Number(event.target.value) })}
                            />
                        </div>
                        <div className="grid gap-3 rounded-md border p-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium">小镇 AI 价格</p>
                                <p className="text-muted-foreground text-sm">价格为 0 时不扣费；这里只配置镇务参谋、居民聊天和探索导演的算力消耗，不会在用户端展示购买入口。</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label>今日计划</Label>
                                    <Input
                                        min={0}
                                        step={1}
                                        type="number"
                                        value={form.adviceCostPower}
                                        onChange={(event) => setForm({ ...form, adviceCostPower: Number(event.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>居民聊天</Label>
                                    <Input
                                        min={0}
                                        step={1}
                                        type="number"
                                        value={form.chatCostPower}
                                        onChange={(event) => setForm({ ...form, chatCostPower: Number(event.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>探索导演</Label>
                                    <Input
                                        min={0}
                                        step={1}
                                        type="number"
                                        value={form.eventCostPower}
                                        onChange={(event) => setForm({ ...form, eventCostPower: Number(event.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                                保存配置
                            </Button>
                            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
                        </div>
                    </CardContent>
                </Card>

                <Card className="config-card">
                    <CardHeader>
                        <CardTitle>测试生成</CardTitle>
                        <CardDescription>保存模型配置后，可在这里直接验证 AI 是否能正常生成。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Textarea
                            value={testPrompt}
                            onChange={(event) => setTestPrompt(event.target.value)}
                            className="min-h-32"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button loading={testMutation.isPending} onClick={() => testMutation.mutate()}>
                                测试模型
                            </Button>
                            {testResult ? <Badge variant="outline">已生成结果</Badge> : null}
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6">
                            {testResult || "保存模型配置后，可在这里测试 AI 是否能正常生成。"}
                        </div>
                    </CardContent>
                </Card>
            </section>

            <Card className="ai-log-section">
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle>调用统计</CardTitle>
                            <CardDescription>统计和日志按调用类型、状态、降级和存档同步过滤。</CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                void logsQuery.refetch();
                            }}
                        >
                            刷新日志
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border p-3">
                            <p className="text-muted-foreground text-sm">总调用</p>
                            <p className="text-2xl font-semibold">{logsQuery.data?.stats.total ?? "-"}</p>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="text-muted-foreground text-sm">今日调用</p>
                            <p className="text-2xl font-semibold">{logsQuery.data?.stats.todayCount ?? "-"}</p>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="text-muted-foreground text-sm">失败</p>
                            <p className="text-2xl font-semibold">{logsQuery.data?.stats.failed ?? "-"}</p>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="text-muted-foreground text-sm">降级</p>
                            <p className="text-2xl font-semibold">{logsQuery.data?.stats.fallback ?? "-"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Select value={typeFilterValue} onValueChange={(value) => setLogFilters({ ...logFilters, type: value === "__all__" ? "" : value })}>
                            <SelectTrigger className="min-w-40">
                                <SelectValue placeholder="全部类型" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">全部类型</SelectItem>
                                <SelectItem value="advice">建议</SelectItem>
                                <SelectItem value="chat">聊天</SelectItem>
                                <SelectItem value="event">事件</SelectItem>
                                <SelectItem value="structured_event">结构化事件</SelectItem>
                                <SelectItem value="test">测试</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={successFilterValue} onValueChange={(value) => setLogFilters({ ...logFilters, success: value === "__all__" ? "" : value })}>
                            <SelectTrigger className="min-w-36">
                                <SelectValue placeholder="全部状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">全部状态</SelectItem>
                                <SelectItem value="true">成功</SelectItem>
                                <SelectItem value="false">失败</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={fallbackFilterValue} onValueChange={(value) => setLogFilters({ ...logFilters, fallbackUsed: value === "__all__" ? "" : value })}>
                            <SelectTrigger className="min-w-40">
                                <SelectValue placeholder="全部降级" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">全部降级</SelectItem>
                                <SelectItem value="true">已降级</SelectItem>
                                <SelectItem value="false">未降级</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="存档 ID"
                            value={logFilters.saveId}
                            onChange={(event) => setLogFilters({ ...logFilters, saveId: event.target.value })}
                            className="min-w-48 flex-1"
                        />
                    </div>

                    <div className="overflow-hidden rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>类型</TableHead>
                                    <TableHead>存档</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead>耗时</TableHead>
                                    <TableHead>错误</TableHead>
                                    <TableHead>时间</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logsQuery.data?.logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{log.type}</TableCell>
                                        <TableCell>{log.saveId?.slice(0, 8) ?? "-"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={log.success ? "default" : log.fallbackUsed ? "secondary" : "destructive"}
                                            >
                                                {log.success ? "成功" : log.fallbackUsed ? "降级" : "失败"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{log.latencyMs}ms</TableCell>
                                        <TableCell>{log.errorMessage || "-"}</TableCell>
                                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {!logsQuery.data?.logs.length ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground">
                                            暂无日志
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
