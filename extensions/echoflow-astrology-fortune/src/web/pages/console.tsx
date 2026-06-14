import { Eye, Save, Settings, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
    useAstrologyFortuneSettingQuery,
    useAvailableLlmModelsQuery,
    useConsoleAstrologyProfilesQuery,
    useConsoleAstrologyReportDetailQuery,
    useConsoleAstrologyReportsQuery,
    useDeleteConsoleAstrologyReportMutation,
    useUpdateAstrologyFortuneSettingMutation,
} from "../services/console/astrology-fortune";
import type { AstrologyReport, AstrologyReportStatus, AstrologyReportType } from "../services/types";

type SettingForm = {
    defaultModelId: string;
    dailyPrice: string;
    reportPrice: string;
    compatibilityPrice: string;
    decisionPrice: string;
};

type ReportFilters = {
    reportType: "all" | AstrologyReportType;
    status: "all" | AstrologyReportStatus;
    userId: string;
    keyword: string;
    isFavorite: "all" | "true" | "false";
};

const defaultForm: SettingForm = { defaultModelId: "", dailyPrice: "0", reportPrice: "0", compatibilityPrice: "0", decisionPrice: "0" };
const defaultFilters: ReportFilters = { reportType: "all", status: "all", userId: "", keyword: "", isFavorite: "all" };
const reportTypes: Array<{ value: AstrologyReportType; label: string }> = [
    { value: "daily", label: "每日运势" },
    { value: "personality", label: "性格画像" },
    { value: "love", label: "感情分析" },
    { value: "career", label: "事业财富" },
    { value: "compatibility", label: "星座配对" },
    { value: "decision", label: "决策占卜" },
];

export default function AstrologyFortuneConsolePage() {
    const [form, setForm] = useState<SettingForm>(defaultForm);
    const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const settingQuery = useAstrologyFortuneSettingQuery();
    const modelsQuery = useAvailableLlmModelsQuery();
    const reportsQuery = useConsoleAstrologyReportsQuery({
        pageSize: 50,
        reportType: filters.reportType === "all" ? undefined : filters.reportType,
        status: filters.status === "all" ? undefined : filters.status,
        userId: filters.userId || undefined,
        keyword: filters.keyword || undefined,
        isFavorite: filters.isFavorite === "all" ? undefined : filters.isFavorite === "true",
    });
    const profilesQuery = useConsoleAstrologyProfilesQuery({ pageSize: 20, userId: filters.userId || undefined });
    const reportDetailQuery = useConsoleAstrologyReportDetailQuery(selectedReportId ?? undefined);
    const updateSettingMutation = useUpdateAstrologyFortuneSettingMutation();
    const deleteReportMutation = useDeleteConsoleAstrologyReportMutation();

    const models = useMemo(() => (modelsQuery.data ?? []).filter((model) => model.modelType === "llm" && model.isActive !== false && model.provider?.isActive !== false), [modelsQuery.data]);
    const reports = reportsQuery.data?.items ?? [];
    const profiles = profilesQuery.data?.items ?? [];
    const selectedModel = models.find((model) => model.id === form.defaultModelId);
    const stats = useMemo(() => buildStats(reports), [reports]);

    useEffect(() => {
        const setting = settingQuery.data;
        if (!setting) return;
        setForm({ defaultModelId: setting.defaultModelId ?? "", dailyPrice: String(setting.dailyPrice ?? 0), reportPrice: String(setting.reportPrice ?? 0), compatibilityPrice: String(setting.compatibilityPrice ?? 0), decisionPrice: String(setting.decisionPrice ?? 0) });
    }, [settingQuery.data]);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setMessage(null);
        if (!form.defaultModelId) {
            setMessage("请选择一个默认 LLM 模型");
            return;
        }
        await updateSettingMutation.mutateAsync({ defaultModelId: form.defaultModelId, dailyPrice: normalizePrice(form.dailyPrice), reportPrice: normalizePrice(form.reportPrice), compatibilityPrice: normalizePrice(form.compatibilityPrice), decisionPrice: normalizePrice(form.decisionPrice) });
        setMessage("配置已保存，用户端将自动使用该模型生成报告。");
    }

    async function handleDeleteReport(reportId: string) {
        await deleteReportMutation.mutateAsync(reportId);
        if (selectedReportId === reportId) setSelectedReportId(null);
        reportsQuery.refetch();
    }

    const loading = settingQuery.isLoading || modelsQuery.isLoading;

    return (
        <main className="astro-console-shell">
            <style>{styles}</style>
            <section className="console-page">
                <header className="console-hero">
                    <div>
                        <div className="hero-kicker"><Settings size={15} /> Operations Console</div>
                        <h1>AI星盘运势运营管理</h1>
                        <p>配置固定模型和价格，查看报告生成记录、失败原因、档案数据和基础运营指标。</p>
                    </div>
                    <div className="model-status">
                        <div>当前模型</div>
                        <strong>{selectedModel?.name || selectedModel?.model || "未配置"}</strong>
                        <span>{selectedModel?.provider?.name || selectedModel?.provider?.provider || "请选择可用模型"}</span>
                    </div>
                </header>

                <div className="stats-grid">
                    <StatCard label="当前列表报告" value={String(stats.total)} />
                    <StatCard label="成功" value={String(stats.success)} tone="green" />
                    <StatCard label="失败" value={String(stats.failed)} tone="red" />
                    <StatCard label="收藏" value={String(stats.favorite)} tone="violet" />
                </div>

                <section className="mt-6 grid grid-cols-[minmax(0,1fr)_320px] gap-6 console-main-grid">
                    <div className="min-w-0 space-y-6">
                        <SettingsForm form={form} models={models} loading={loading} message={message} saving={updateSettingMutation.isPending} onSubmit={handleSubmit} onChange={(key, value) => { setForm((previous) => ({ ...previous, [key]: value })); setMessage(null); }} />
                        <ReportOperations filters={filters} reports={reports} loading={reportsQuery.isLoading} onFiltersChange={setFilters} onOpen={setSelectedReportId} onDelete={handleDeleteReport} />
                        <ProfileOperations profiles={profiles} loading={profilesQuery.isLoading} />
                    </div>

                    <aside className="min-w-0 space-y-6">
                        <InfoPanel />
                    </aside>
                </section>
            </section>
            {selectedReportId && <ReportDetailModal report={reportDetailQuery.data ?? null} loading={reportDetailQuery.isLoading} onClose={() => setSelectedReportId(null)} onDelete={handleDeleteReport} />}
        </main>
    );
}

function SettingsForm({ form, models, loading, message, saving, onSubmit, onChange }: { form: SettingForm; models: Array<{ id: string; name?: string; model?: string; provider?: { name?: string; provider?: string } }>; loading: boolean; message: string | null; saving: boolean; onSubmit: (event: FormEvent) => void; onChange: (key: keyof SettingForm, value: string) => void }) {
    return <form className="card" onSubmit={onSubmit}><div className="mb-5 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={20} /></div><div><h2 className="text-xl font-bold">默认模型与价格</h2><p className="text-sm text-slate-500">用户端隐藏模型选择。</p></div></div><label className="block text-sm font-medium text-slate-700">固定生成模型<select className="input" value={form.defaultModelId} onChange={(event) => onChange("defaultModelId", event.target.value)} disabled={loading}><option value="">请选择默认模型</option>{models.map((model) => <option key={model.id} value={model.id}>{formatModelLabel(model)}</option>)}</select></label>{!models.length && !loading && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">暂无可用 LLM 模型，请先在平台 AI 模型管理中启用模型。</div>}<div className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1"><PriceField label="每日运势" value={form.dailyPrice} onChange={(value) => onChange("dailyPrice", value)} /><PriceField label="深度报告" value={form.reportPrice} onChange={(value) => onChange("reportPrice", value)} /><PriceField label="星座配对" value={form.compatibilityPrice} onChange={(value) => onChange("compatibilityPrice", value)} /><PriceField label="决策占卜" value={form.decisionPrice} onChange={(value) => onChange("decisionPrice", value)} /></div>{message && <div className="mt-5 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</div>}<button className="primary" type="submit" disabled={loading || saving}><Save size={18} />{saving ? "保存中..." : "保存配置"}</button></form>;
}

function ReportOperations({ filters, reports, loading, onFiltersChange, onOpen, onDelete }: { filters: ReportFilters; reports: AstrologyReport[]; loading: boolean; onFiltersChange: (filters: ReportFilters) => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
    return <section className="card"><div className="mb-5 flex items-center justify-between gap-4 max-lg:flex-col max-lg:items-start"><div><h2 className="text-xl font-bold">报告记录</h2><p className="text-sm text-slate-500">查看生成记录、状态和错误信息。</p></div><button className="ghost" type="button" onClick={() => onFiltersChange(defaultFilters)}>重置筛选</button></div><div className="mb-5 grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1"><input className="input mt-0" placeholder="用户 ID" value={filters.userId} onChange={(event) => onFiltersChange({ ...filters, userId: event.target.value })} /><input className="input mt-0" placeholder="关键词" value={filters.keyword} onChange={(event) => onFiltersChange({ ...filters, keyword: event.target.value })} /><select className="input mt-0" value={filters.reportType} onChange={(event) => onFiltersChange({ ...filters, reportType: event.target.value as ReportFilters["reportType"] })}><option value="all">全部类型</option>{reportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select className="input mt-0" value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as ReportFilters["status"] })}><option value="all">全部状态</option><option value="pending">pending</option><option value="processing">processing</option><option value="success">success</option><option value="failed">failed</option></select><select className="input mt-0" value={filters.isFavorite} onChange={(event) => onFiltersChange({ ...filters, isFavorite: event.target.value as ReportFilters["isFavorite"] })}><option value="all">全部收藏</option><option value="true">仅收藏</option><option value="false">未收藏</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="text-slate-500"><tr><th className="py-3">标题</th><th>类型</th><th>状态</th><th>用户</th><th>积分</th><th>时间</th><th>操作</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id} className="border-t border-slate-100"><td className="max-w-72 py-3"><div className="truncate font-medium">{report.result?.title || report.question || report.id}</div>{report.errorMessage && <div className="truncate text-xs text-red-500">{report.errorMessage}</div>}</td><td>{reportLabel(report.reportType)}</td><td><StatusPill status={report.status} /></td><td className="font-mono text-xs">{report.userId}</td><td>{String((report as AstrologyReport & { costCredits?: number }).costCredits ?? 0)}</td><td>{new Date(report.createdAt).toLocaleString()}</td><td><div className="flex gap-2"><button className="icon-action" type="button" onClick={() => onOpen(report.id)}><Eye size={15} /></button><button className="icon-action danger" type="button" onClick={() => onDelete(report.id)}><Trash2 size={15} /></button></div></td></tr>)}{!reports.length && <tr><td className="py-8 text-center text-slate-500" colSpan={7}>{loading ? "加载中..." : "暂无报告"}</td></tr>}</tbody></table></div></section>;
}

function ProfileOperations({ profiles, loading }: { profiles: Array<{ id: string; userId: string; name: string; zodiacSign: string; chineseZodiac: string; birthDate: string; birthPlace?: string; createdAt: string }>; loading: boolean }) {
    return <section className="card"><div className="mb-5"><h2 className="text-xl font-bold">档案记录</h2><p className="text-sm text-slate-500">查看用户创建的星盘档案。</p></div><div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">{profiles.map((profile) => <div key={profile.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="font-bold">{profile.name}</div><div className="rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-700">{profile.zodiacSign}</div></div><div className="mt-2 text-sm text-slate-600">生肖 {profile.chineseZodiac} · {profile.birthDate}</div><div className="mt-1 text-xs text-slate-500">{profile.birthPlace || "未填写出生地"}</div><div className="mt-3 truncate font-mono text-xs text-slate-400">用户 {profile.userId}</div></div>)}{!profiles.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{loading ? "加载中..." : "暂无档案"}</div>}</div></section>;
}

function ReportDetailModal({ report, loading, onClose, onDelete }: { report: AstrologyReport | null; loading: boolean; onClose: () => void; onDelete: (id: string) => void }) {
    return <div className="modal-mask"><div className="modal-panel"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-sm text-violet-500">报告详情</div><h2 className="mt-1 text-2xl font-black">{report?.result?.title || report?.question || "加载中..."}</h2></div><button className="icon-action" type="button" onClick={onClose}><X size={18} /></button></div>{loading ? <div className="py-16 text-center text-slate-500">加载中...</div> : report ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm max-sm:grid-cols-1"><Detail label="报告 ID" value={report.id} /><Detail label="用户 ID" value={report.userId} /><Detail label="类型" value={reportLabel(report.reportType)} /><Detail label="状态" value={report.status} /><Detail label="模型 ID" value={report.modelId} /><Detail label="Provider ID" value={report.providerId} /></div>{report.errorMessage && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{report.errorMessage}</div>}<p className="rounded-2xl bg-violet-50 p-4 text-sm leading-7 text-slate-700">{report.result?.summary || report.resultText || "暂无内容"}</p>{report.result?.sections?.map((section) => <article key={section.heading} className="rounded-2xl border border-slate-100 p-4"><h3 className="font-bold">{section.heading}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{section.content}</p></article>)}<button className="danger-button" type="button" onClick={() => onDelete(report.id)}><Trash2 size={16} />删除报告</button></div> : <div className="py-16 text-center text-slate-500">报告不存在</div>}</div></div>;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 break-all text-sm font-medium">{value || "-"}</div></div>;
}

function StatCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "green" | "red" | "violet" }) {
    return <div className={`stat-card ${tone}`}><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
}

function StatusPill({ status }: { status: AstrologyReportStatus }) {
    return <span className={`status-pill ${status}`}>{status}</span>;
}

function InfoPanel() {
    return <aside className="card"><h2 className="text-lg font-bold">配置说明</h2><div className="mt-4 space-y-4 text-sm leading-6 text-slate-600"><p>默认模型由管理员固定，用户端不会看到模型字段。</p><p>价格单位沿用系统积分，设置为 0 表示免费。</p><p>报告入库后预扣积分，AI 失败会自动退款。</p><p>如果默认模型被禁用，用户端会提示联系管理员重新配置。</p></div></aside>;
}

function PriceField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input className="input" type="number" min="0" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function normalizePrice(value: string) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function formatModelLabel(model: { name?: string; model?: string; provider?: { name?: string; provider?: string } }) {
    const provider = model.provider?.name || model.provider?.provider || "未知供应商";
    const name = model.name || model.model || "未命名模型";
    const key = model.model && model.model !== name ? ` (${model.model})` : "";
    return `${provider} / ${name}${key}`;
}

function reportLabel(type: AstrologyReportType) {
    return reportTypes.find((item) => item.value === type)?.label || type;
}

function buildStats(reports: AstrologyReport[]) {
    return { total: reports.length, success: reports.filter((item) => item.status === "success").length, failed: reports.filter((item) => item.status === "failed").length, favorite: reports.filter((item) => item.isFavorite).length };
}

const styles = `
body { margin: 0; }
.astro-console-shell { --bg: var(--background, #f7f5ff); --fg: var(--foreground, #111827); --card: var(--card, #fff); --border: var(--border, #e9ddff); --muted: var(--muted-foreground, #64748b); --primary: var(--primary, #7c3aed); min-height: 100vh; background: radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 10%, transparent), transparent 32%), var(--bg); color: var(--fg); font-family: Inter, system-ui, sans-serif; }
.dark .astro-console-shell { --bg: #080617; --fg: #f8f7ff; --card: #120d2d; --border: rgba(255,255,255,.1); --muted: #a9a1c5; }
.console-page { width: min(1280px, 100%); margin: 0 auto; padding: 28px 18px; }
.console-hero { display: flex; align-items: stretch; justify-content: space-between; gap: 24px; border: 1px solid var(--border); border-radius: 30px; padding: 26px; background: color-mix(in oklab, var(--card) 92%, transparent); box-shadow: 0 24px 70px color-mix(in oklab, var(--primary) 14%, transparent); }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; background: color-mix(in oklab, var(--primary) 10%, var(--card)); color: var(--primary); padding: 7px 10px; font-size: 13px; font-weight: 900; }
.console-hero h1 { margin: 14px 0 8px; font-size: clamp(30px, 4vw, 44px); letter-spacing: -.04em; }
.console-hero p { margin: 0; max-width: 680px; color: var(--muted); line-height: 1.7; }
.model-status { min-width: 270px; border: 1px solid var(--border); border-radius: 24px; background: color-mix(in oklab, var(--primary) 7%, var(--card)); padding: 20px; }
.model-status div, .model-status span { color: var(--muted); font-size: 13px; }
.model-status strong { display: block; margin: 8px 0 4px; font-size: 22px; }
.stats-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.card, .stat-card { border-radius: 26px; border: 1px solid var(--border); background: var(--card); padding: 22px; box-shadow: 0 18px 50px color-mix(in oklab, var(--primary) 10%, transparent); }
.astro-console-shell .min-w-\[880px\] { min-width: 760px !important; }
.stat-card.green { background: #f0fdf4; border-color: #bbf7d0; }
.stat-card.red { background: #fff1f2; border-color: #fecdd3; }
.stat-card.violet { background: #f5f3ff; border-color: #ddd6fe; }
.dark .stat-card.green, .dark .stat-card.red, .dark .stat-card.violet { background: var(--card); }
.input { margin-top: 8px; width: 100%; border-radius: 16px; border: 1px solid var(--border); background: var(--card); color: var(--fg); padding: 12px 14px; outline: none; }
.input:focus { box-shadow: 0 0 0 3px rgba(167,139,250,.35); }
.primary, .ghost, .danger-button, .icon-action { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 0; padding: 10px 14px; font-weight: 700; }
.primary { margin-top: 24px; color: white; background: var(--primary); box-shadow: 0 14px 28px color-mix(in oklab, var(--primary) 22%, transparent); }
.primary:disabled { opacity: .6; }
.ghost { background: color-mix(in oklab, var(--primary) 10%, var(--card)); color: var(--primary); }
.danger-button { color: white; background: #e11d48; }
.icon-action { justify-content: center; width: 34px; height: 34px; padding: 0; background: color-mix(in oklab, var(--primary) 10%, var(--card)); color: var(--primary); }
.icon-action.danger { background: #fff1f2; color: #e11d48; }
.status-pill { display: inline-flex; border-radius: 999px; padding: 4px 9px; background: #f1f5f9; color: #475569; font-size: 12px; }
.status-pill.success { background: #dcfce7; color: #15803d; }
.status-pill.failed { background: #ffe4e6; color: #be123c; }
.status-pill.processing, .status-pill.pending { background: #fef3c7; color: #a16207; }
.modal-mask { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(15,23,42,.46); backdrop-filter: blur(8px); }
.modal-panel { max-height: 88vh; width: min(900px, 100%); overflow: auto; border: 1px solid var(--border); border-radius: 28px; background: var(--card); padding: 26px; box-shadow: 0 40px 100px rgba(15,23,42,.24); }
@media (max-width: 1280px) { .console-main-grid { grid-template-columns: 1fr; } }
@media (max-width: 960px) { .console-hero { flex-direction: column; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .console-page { padding: 16px 12px; } .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .modal-mask { padding: 0; align-items: stretch; } .modal-panel { width: 100%; max-height: 100vh; border-radius: 0; } table { min-width: 760px; } }
`;
