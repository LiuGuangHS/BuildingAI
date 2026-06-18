import { useEffect, useMemo, useState } from "react";

import { useAdminContractGenerationConfigQuery, useAdminLlmModelsQuery, useUpdateAdminContractGenerationConfigMutation } from "../../services/console";

export default function ContractGenerationConfigPage() {
    const { data: config } = useAdminContractGenerationConfigQuery();
    const { data: models = [], isLoading } = useAdminLlmModelsQuery();
    const updateMutation = useUpdateAdminContractGenerationConfigMutation();
    const [modelId, setModelId] = useState("");
    const [message, setMessage] = useState("");
    const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [modelId, models]);
    const currentModel = selectedModel ?? config?.model ?? null;

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
                <span className={`ec-status-pill ${config?.configured ? "is-success" : "is-warning"}`}>{config?.configured ? "已配置" : "未配置"}</span>
            </header>

            <section className="ec-config-layout">
                <article className="ec-card">
                    <div className="ec-section-title">
                        <div>
                            <h2>固定生成模型</h2>
                            <p>只展示已启用 Provider 下的 LLM 模型，保存时后端会再次校验。</p>
                        </div>
                    </div>

                    <label className="ec-field">
                        <span>生成模型</span>
                        <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={isLoading}>
                            <option value="">{isLoading ? "模型加载中..." : "请选择固定模型"}</option>
                            {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.providerName} / {model.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    {currentModel && (
                        <div className="ec-model-preview">
                            <div>
                                <span>当前选择</span>
                                <strong>{currentModel.providerName} / {currentModel.name}</strong>
                            </div>
                            <dl>
                                <div><dt>Provider</dt><dd>{currentModel.provider}</dd></div>
                                <div><dt>合同单价</dt><dd>{formatCredits(currentModel.pricePerContract)}</dd></div>
                            </dl>
                        </div>
                    )}

                    {models.length === 0 && !isLoading && <div className="ec-banner is-danger">暂无可用 LLM 模型，请先在主后台启用 Provider 和模型。</div>}
                    {message && <div className={`ec-banner ${message.includes("失败") ? "is-danger" : "is-success"}`}>{message}</div>}

                    <div className="ec-actions">
                        <button className="ec-button is-primary" onClick={handleSave} disabled={!modelId || updateMutation.isPending}>
                            {updateMutation.isPending ? "保存中..." : "保存配置"}
                        </button>
                    </div>
                </article>

                <aside className="ec-card">
                    <div className="ec-section-title">
                        <div>
                            <h2>运行状态</h2>
                            <p>用户端不暴露模型选择，会自动使用这里保存的固定模型。</p>
                        </div>
                    </div>
                    <dl className="ec-detail-list">
                        <div><dt>配置状态</dt><dd>{config?.configured ? "可用" : "待配置"}</dd></div>
                        <div><dt>当前模型</dt><dd>{config?.model ? `${config.model.providerName} / ${config.model.name}` : "-"}</dd></div>
                        <div><dt>模型 ID</dt><dd className="ec-mono">{config?.modelId || "-"}</dd></div>
                        <div><dt>合同单价</dt><dd>{formatCredits(config?.model?.pricePerContract)}</dd></div>
                        <div><dt>可选模型</dt><dd>{models.length} 个</dd></div>
                    </dl>
                </aside>
            </section>
        </main>
    );
}

function formatCredits(value?: number) {
    if (!value) return "0 积分";
    return `${value} 积分`;
}
