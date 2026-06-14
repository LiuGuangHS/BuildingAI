import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getTownAiConfig, getTownAiLogs, listTownAiModels, testTownAi, updateTownAiConfig } from "../../services/console/town";
import type { TownAiConfig } from "../../services/types";

const defaultConfig: TownAiConfig = {
    enabled: false,
    defaultModelId: null,
    temperature: 0.8,
    maxTokens: 1200,
    fallbackToRules: true,
    dailyLimitPerUser: 100,
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
            <h1>AI 配置</h1>
            <p className="console-muted">管理员统一指定模型。用户侧不暴露模型选择，只提示 AI 生成可能消耗额度；实际计费由平台和模型配置决定。</p>

            <section className="ai-config-grid">
                <div className="console-table config-card">
                    <h2>模型设置</h2>
                    <label className="config-row toggle-row">
                        <span>启用 AI</span>
                        <input checked={form.enabled} type="checkbox" onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                    </label>
                    <label className="config-row">
                        <span>默认模型</span>
                        <select value={form.defaultModelId ?? ""} onChange={(event) => setForm({ ...form, defaultModelId: event.target.value || null })}>
                            <option value="">未选择模型</option>
                            {modelsQuery.data?.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.providerName} / {model.name} ({model.model})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="config-row">
                        <span>温度</span>
                        <input max={2} min={0} step={0.1} type="number" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })} />
                    </label>
                    <label className="config-row">
                        <span>最大输出 tokens</span>
                        <input max={4000} min={200} step={100} type="number" value={form.maxTokens} onChange={(event) => setForm({ ...form, maxTokens: Number(event.target.value) })} />
                    </label>
                    <label className="config-row toggle-row">
                        <span>失败降级本地规则</span>
                        <input checked={form.fallbackToRules} type="checkbox" onChange={(event) => setForm({ ...form, fallbackToRules: event.target.checked })} />
                    </label>
                    <label className="config-row">
                        <span>每用户每日调用上限</span>
                        <input min={0} step={10} type="number" value={form.dailyLimitPerUser} onChange={(event) => setForm({ ...form, dailyLimitPerUser: Number(event.target.value) })} />
                    </label>
                    <button className="console-primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                        保存配置
                    </button>
                    {message ? <p className="console-message">{message}</p> : null}
                </div>

                <div className="console-table config-card">
                    <h2>测试生成</h2>
                    <textarea value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} />
                    <button className="console-primary" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
                        测试模型
                    </button>
                    <div className="test-result">{testResult || "保存模型配置后，可在这里测试 AI 是否能正常生成。"}</div>
                </div>
            </section>

            <section className="console-table ai-log-section">
                <div className="console-section-header">
                    <div>
                        <h2>调用统计</h2>
                        <p className="console-muted">统计和日志会按调用类型、状态、降级和存档同步过滤。</p>
                    </div>
                    <div className="console-actions ai-log-filters">
                        <select value={logFilters.type} onChange={(event) => setLogFilters({ ...logFilters, type: event.target.value })}>
                            <option value="">全部类型</option>
                            <option value="advice">建议</option>
                            <option value="chat">聊天</option>
                            <option value="event">事件</option>
                            <option value="structured_event">结构化事件</option>
                            <option value="test">测试</option>
                        </select>
                        <select value={logFilters.success} onChange={(event) => setLogFilters({ ...logFilters, success: event.target.value })}>
                            <option value="">全部状态</option>
                            <option value="true">成功</option>
                            <option value="false">失败</option>
                        </select>
                        <select value={logFilters.fallbackUsed} onChange={(event) => setLogFilters({ ...logFilters, fallbackUsed: event.target.value })}>
                            <option value="">全部降级</option>
                            <option value="true">已降级</option>
                            <option value="false">未降级</option>
                        </select>
                        <input placeholder="存档 ID" value={logFilters.saveId} onChange={(event) => setLogFilters({ ...logFilters, saveId: event.target.value })} />
                    </div>
                </div>
                <div className="console-stats compact">
                    <div><span>总调用</span><strong>{logsQuery.data?.stats.total ?? "-"}</strong></div>
                    <div><span>今日调用</span><strong>{logsQuery.data?.stats.todayCount ?? "-"}</strong></div>
                    <div><span>失败</span><strong>{logsQuery.data?.stats.failed ?? "-"}</strong></div>
                    <div><span>降级</span><strong>{logsQuery.data?.stats.fallback ?? "-"}</strong></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>类型</th>
                            <th>存档</th>
                            <th>状态</th>
                            <th>耗时</th>
                            <th>错误</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logsQuery.data?.logs.map((log) => (
                            <tr key={log.id}>
                                <td>{log.type}</td>
                                <td>{log.saveId?.slice(0, 8) ?? "-"}</td>
                                <td>{log.success ? "成功" : log.fallbackUsed ? "降级" : "失败"}</td>
                                <td>{log.latencyMs}ms</td>
                                <td>{log.errorMessage || "-"}</td>
                                <td>{new Date(log.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </main>
    );
}
