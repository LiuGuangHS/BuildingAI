import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@buildingai/ui/components/ui/table";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Eye,
    Heart,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Settings,
    Sparkles,
    Trash2,
    Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { priceGroupLabel, reportLabel, reportTypeOptions, statusLabel, statusOptions } from "../constants/report-types";
import {
    useAstrologyFortuneSettingQuery,
    useAvailableLlmModelsQuery,
    useCleanupStaleAstrologyReportsMutation,
    useConsoleAstrologyProfilesQuery,
    useConsoleAstrologyReportDetailQuery,
    useConsoleAstrologyReportStatsQuery,
    useConsoleAstrologyReportsQuery,
    useDeleteConsoleAstrologyReportMutation,
    useUpdateAstrologyFortuneSettingMutation,
} from "../services/console/astrology-fortune";
import type { AstrologyProfile, AstrologyReport, AstrologyReportStats, AstrologyReportStatus, AstrologyReportType, QueryAstrologyReportsParams } from "../services/types";

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

type ProfileFilters = {
    userId: string;
    keyword: string;
};

type ConsoleTab = "settings" | "reports" | "profiles";
type DeleteTarget = { source: "row" | "detail"; report: AstrologyReport };

const PAGE_SIZE = 20;

const defaultForm: SettingForm = {
    defaultModelId: "",
    dailyPrice: "0",
    reportPrice: "0",
    compatibilityPrice: "0",
    decisionPrice: "0",
};

const defaultReportFilters: ReportFilters = {
    reportType: "all",
    status: "all",
    userId: "",
    keyword: "",
    isFavorite: "all",
};

const defaultProfileFilters: ProfileFilters = {
    userId: "",
    keyword: "",
};

const emptyReportStats: AstrologyReportStats = {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    busy: 0,
    favorite: 0,
};

export default function AstrologyFortuneConsolePage() {
    useDocumentHead({ title: "AI星盘运势管理" });

    const [form, setForm] = useState<SettingForm>(defaultForm);
    const [reportDraftFilters, setReportDraftFilters] = useState<ReportFilters>(defaultReportFilters);
    const [reportFilters, setReportFilters] = useState<ReportFilters>(defaultReportFilters);
    const [profileDraftFilters, setProfileDraftFilters] = useState<ProfileFilters>(defaultProfileFilters);
    const [profileFilters, setProfileFilters] = useState<ProfileFilters>(defaultProfileFilters);
    const [reportPage, setReportPage] = useState(1);
    const [profilePage, setProfilePage] = useState(1);
    const [activeTab, setActiveTab] = useState<ConsoleTab>("settings");
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

    const settingQuery = useAstrologyFortuneSettingQuery();
    const modelsQuery = useAvailableLlmModelsQuery();
    const reportStatsParams = useMemo<QueryAstrologyReportsParams>(() => ({
        reportType: reportFilters.reportType === "all" ? undefined : reportFilters.reportType,
        status: reportFilters.status === "all" ? undefined : reportFilters.status,
        userId: reportFilters.userId || undefined,
        keyword: reportFilters.keyword || undefined,
        isFavorite: reportFilters.isFavorite === "all" ? undefined : reportFilters.isFavorite === "true",
    }), [reportFilters]);
    const reportsQuery = useConsoleAstrologyReportsQuery({
        page: reportPage,
        pageSize: PAGE_SIZE,
        ...reportStatsParams,
    });
    const reportStatsQuery = useConsoleAstrologyReportStatsQuery(reportStatsParams);
    const profilesQuery = useConsoleAstrologyProfilesQuery({
        page: profilePage,
        pageSize: PAGE_SIZE,
        userId: profileFilters.userId || undefined,
        keyword: profileFilters.keyword || undefined,
    });
    const reportDetailQuery = useConsoleAstrologyReportDetailQuery(selectedReportId ?? undefined);
    const updateSettingMutation = useUpdateAstrologyFortuneSettingMutation();
    const deleteReportMutation = useDeleteConsoleAstrologyReportMutation();
    const cleanupStaleMutation = useCleanupStaleAstrologyReportsMutation();

    const models = useMemo(
        () => (modelsQuery.data ?? []).filter((model) => model.modelType === "llm" && model.isActive !== false && model.provider?.isActive !== false),
        [modelsQuery.data],
    );
    const reports = reportsQuery.data?.items ?? [];
    const profiles = profilesQuery.data?.items ?? [];
    const selectedModel = models.find((model) => model.id === form.defaultModelId);
    const stats = reportStatsQuery.data ?? emptyReportStats;
    const loadingSettings = settingQuery.isLoading || modelsQuery.isLoading;

    const reportPagination = usePagination({
        total: reportsQuery.data?.total ?? 0,
        pageSize: reportsQuery.data?.pageSize ?? PAGE_SIZE,
        page: reportPage,
        onPageChange: setReportPage,
    });
    const profilePagination = usePagination({
        total: profilesQuery.data?.total ?? 0,
        pageSize: profilesQuery.data?.pageSize ?? PAGE_SIZE,
        page: profilePage,
        onPageChange: setProfilePage,
    });

    useEffect(() => {
        const setting = settingQuery.data;
        if (!setting) return;
        setForm({
            defaultModelId: setting.defaultModelId ?? "",
            dailyPrice: formatPriceInput(setting.dailyPrice),
            reportPrice: formatPriceInput(setting.reportPrice),
            compatibilityPrice: formatPriceInput(setting.compatibilityPrice),
            decisionPrice: formatPriceInput(setting.decisionPrice),
        });
    }, [settingQuery.data]);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!form.defaultModelId) {
            toast.error("请选择一个已启用的 LLM 模型");
            return;
        }
        try {
            await updateSettingMutation.mutateAsync({
                defaultModelId: form.defaultModelId,
                dailyPrice: normalizePrice(form.dailyPrice),
                reportPrice: normalizePrice(form.reportPrice),
                compatibilityPrice: normalizePrice(form.compatibilityPrice),
                decisionPrice: normalizePrice(form.decisionPrice),
            });
            toast.success("配置已保存");
        } catch (error) {
            toast.error(getErrorMessage(error, "保存失败，请检查模型是否仍然可用。"));
        }
    }

    async function handleDeleteReport() {
        if (!deleteTarget || isBusy(deleteTarget.report.status)) return;
        try {
            await deleteReportMutation.mutateAsync(deleteTarget.report.id);
            if (selectedReportId === deleteTarget.report.id) setSelectedReportId(null);
            setDeleteTarget(null);
            toast.success("报告已删除");
        } catch (error) {
            toast.error(getErrorMessage(error, "删除失败。"));
        }
    }

    async function handleCleanupStaleReports() {
        try {
            const result = await cleanupStaleMutation.mutateAsync();
            toast.success(`已处理 ${result.affected ?? 0} 条超时任务`);
        } catch (error) {
            toast.error(getErrorMessage(error, "处理超时任务失败。"));
        }
    }

    function applyReportFilters(filters = reportDraftFilters) {
        setReportFilters(filters);
        setReportPage(1);
    }

    function applyProfileFilters(filters = profileDraftFilters) {
        setProfileFilters(filters);
        setProfilePage(1);
    }

    return (
        <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-md">
                        <Sparkles className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold">AI星盘运势管理</h1>
                        <p className="text-muted-foreground mt-1 text-sm">模型、积分价格、生成记录和用户档案分区管理。</p>
                    </div>
                </div>
                <div className="bg-card min-w-64 rounded-md border p-3">
                    <div className="text-muted-foreground text-xs">{selectedModel ? "默认模型已配置" : "默认模型未配置"}</div>
                    <div className="mt-1 truncate text-sm font-medium">{selectedModel ? formatModelName(selectedModel) : "请选择 LLM 模型"}</div>
                </div>
            </header>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="运营概览">
                <Metric icon={<Search className="size-4" />} label="筛选结果" value={formatMetricValue(stats.total, reportStatsQuery.isLoading)} />
                <Metric icon={<CheckCircle2 className="size-4" />} label="成功" value={formatMetricValue(stats.success, reportStatsQuery.isLoading)} />
                <Metric icon={<Clock3 className="size-4" />} label="处理中" value={formatMetricValue(stats.busy, reportStatsQuery.isLoading)} />
                <Metric icon={<Heart className="size-4" />} label="收藏" value={formatMetricValue(stats.favorite, reportStatsQuery.isLoading)} />
            </section>

            <nav className="inline-flex flex-wrap gap-1 rounded-md border bg-muted p-1" aria-label="管理分区">
                <TabButton active={activeTab === "settings"} icon={<Settings className="size-4" />} label="模型与价格" onClick={() => setActiveTab("settings")} />
                <TabButton active={activeTab === "reports"} icon={<Sparkles className="size-4" />} label="报告记录" onClick={() => setActiveTab("reports")} />
                <TabButton active={activeTab === "profiles"} icon={<Users className="size-4" />} label="用户档案" onClick={() => setActiveTab("profiles")} />
            </nav>

            {activeTab === "settings" && (
                <SettingsPanel
                    form={form}
                    models={models}
                    selectedModel={selectedModel}
                    loading={loadingSettings}
                    saving={updateSettingMutation.isPending}
                    onSubmit={handleSubmit}
                    onChange={(key, value) => setForm((previous) => ({ ...previous, [key]: value }))}
                />
            )}

            {activeTab === "reports" && (
                <ReportsPanel
                    filters={reportDraftFilters}
                    reports={reports}
                    total={reportsQuery.data?.total ?? 0}
                    loading={reportsQuery.isLoading}
                    deletingId={deleteReportMutation.variables}
                    cleanupLoading={cleanupStaleMutation.isPending}
                    PaginationComponent={reportPagination.PaginationComponent}
                    onFiltersChange={setReportDraftFilters}
                    onApplyFilters={applyReportFilters}
                    onResetFilters={() => {
                        setReportDraftFilters(defaultReportFilters);
                        applyReportFilters(defaultReportFilters);
                    }}
                    onOpen={setSelectedReportId}
                    onDelete={(report) => setDeleteTarget({ source: "row", report })}
                    onCleanupStale={handleCleanupStaleReports}
                />
            )}

            {activeTab === "profiles" && (
                <ProfilesPanel
                    filters={profileDraftFilters}
                    profiles={profiles}
                    total={profilesQuery.data?.total ?? 0}
                    loading={profilesQuery.isLoading}
                    PaginationComponent={profilePagination.PaginationComponent}
                    onFiltersChange={setProfileDraftFilters}
                    onApplyFilters={applyProfileFilters}
                    onResetFilters={() => {
                        setProfileDraftFilters(defaultProfileFilters);
                        applyProfileFilters(defaultProfileFilters);
                    }}
                />
            )}

            <ReportDetailDialog
                report={reportDetailQuery.data ?? null}
                loading={reportDetailQuery.isLoading}
                open={Boolean(selectedReportId)}
                onOpenChange={(open) => {
                    if (!open) setSelectedReportId(null);
                }}
                onDelete={(report) => setDeleteTarget({ source: "detail", report })}
            />

            <DeleteReportDialog
                target={deleteTarget}
                deleting={deleteReportMutation.isPending}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                onConfirm={handleDeleteReport}
            />
        </main>
    );
}

function SettingsPanel({
    form,
    models,
    selectedModel,
    loading,
    saving,
    onSubmit,
    onChange,
}: {
    form: SettingForm;
    models: Array<{ id: string; name?: string; model?: string; providerName?: string; provider?: { name?: string; provider?: string } }>;
    selectedModel?: { name?: string; model?: string; providerName?: string; provider?: { name?: string; provider?: string } };
    loading: boolean;
    saving: boolean;
    onSubmit: (event: FormEvent) => void;
    onChange: (key: keyof SettingForm, value: string) => void;
}) {
    return (
        <section className="rounded-md border bg-card p-4">
            <PanelHeader
                title="模型与价格"
                description="这里是管理员配置区，用户端不展示模型选择。"
                aside={(
                    <div className="min-w-56 rounded-md bg-muted p-3">
                        <div className="text-muted-foreground text-xs">{selectedModel ? selectedModel.providerName || selectedModel.provider?.name || selectedModel.provider?.provider : "未选择供应商"}</div>
                        <div className="mt-1 truncate text-sm font-medium">{selectedModel ? formatModelName(selectedModel) : "未配置"}</div>
                    </div>
                )}
            />

            <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
                <div className="space-y-2 md:col-span-2">
                    <Label>固定生成模型</Label>
                    <Select value={form.defaultModelId || "none"} onValueChange={(value) => onChange("defaultModelId", value === "none" ? "" : value)} disabled={loading}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择默认 LLM 模型" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">请选择默认 LLM 模型</SelectItem>
                            {models.map((model) => <SelectItem key={model.id} value={model.id}>{formatModelLabel(model)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {!models.length && !loading && (
                    <div className="border-border bg-muted text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm md:col-span-2">
                        <AlertCircle className="size-4" />
                        暂无已启用的 LLM 模型，请先在平台 AI 模型管理中启用模型和 Provider。
                    </div>
                )}

                <PriceField label="每日运势" value={form.dailyPrice} onChange={(value) => onChange("dailyPrice", value)} />
                <PriceField label="通用深度报告" value={form.reportPrice} onChange={(value) => onChange("reportPrice", value)} />
                <PriceField label="星座配对" value={form.compatibilityPrice} onChange={(value) => onChange("compatibilityPrice", value)} />
                <PriceField label="决策占卜" value={form.decisionPrice} onChange={(value) => onChange("decisionPrice", value)} />

                <div className="flex flex-wrap gap-2 md:col-span-2">
                    {reportTypeOptions.map((item) => (
                        <Badge key={item.value} variant="outline">
                            {item.label}
                            <span className="text-muted-foreground ml-1">{priceGroupLabel(item.priceGroup)}</span>
                        </Badge>
                    ))}
                </div>

                <div className="flex justify-end md:col-span-2">
                    <Button type="submit" disabled={loading} loading={saving}>
                        <Save className="size-4" />
                        保存配置
                    </Button>
                </div>
            </form>
        </section>
    );
}

function ReportsPanel({
    filters,
    reports,
    total,
    loading,
    deletingId,
    cleanupLoading,
    PaginationComponent,
    onFiltersChange,
    onApplyFilters,
    onResetFilters,
    onOpen,
    onDelete,
    onCleanupStale,
}: {
    filters: ReportFilters;
    reports: AstrologyReport[];
    total: number;
    loading: boolean;
    deletingId?: string;
    cleanupLoading: boolean;
    PaginationComponent: React.FC<{ className?: string }>;
    onFiltersChange: (filters: ReportFilters) => void;
    onApplyFilters: () => void;
    onResetFilters: () => void;
    onOpen: (id: string) => void;
    onDelete: (report: AstrologyReport) => void;
    onCleanupStale: () => void;
}) {
    return (
        <section className="rounded-md border bg-card p-4">
            <PanelHeader
                title="报告记录"
                description={`共 ${total} 条匹配记录。处理中记录不能删除，避免后台任务写回软删除数据。`}
                aside={(
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={onResetFilters}>
                            <RotateCcw className="size-4" />
                            重置
                        </Button>
                        <Button variant="outline" onClick={onCleanupStale} loading={cleanupLoading}>
                            <RefreshCw className="size-4" />
                            处理超时任务
                        </Button>
                    </div>
                )}
            />

            <form
                className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_minmax(220px,1.4fr)_repeat(3,minmax(130px,.8fr))_auto]"
                onSubmit={(event) => {
                    event.preventDefault();
                    onApplyFilters();
                }}
            >
                <Input placeholder="用户 ID" value={filters.userId} onChange={(event) => onFiltersChange({ ...filters, userId: event.target.value })} />
                <Input placeholder="标题、问题或正文关键词" value={filters.keyword} onChange={(event) => onFiltersChange({ ...filters, keyword: event.target.value })} />
                <ReportTypeSelect value={filters.reportType} onChange={(value) => onFiltersChange({ ...filters, reportType: value })} />
                <StatusSelect value={filters.status} onChange={(value) => onFiltersChange({ ...filters, status: value })} />
                <FavoriteSelect value={filters.isFavorite} onChange={(value) => onFiltersChange({ ...filters, isFavorite: value })} />
                <Button type="submit">
                    <Search className="size-4" />
                    搜索
                </Button>
            </form>

            <DataTable loading={loading}>
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            <TableHead>报告</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>用户</TableHead>
                            <TableHead>积分</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="w-24">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report) => (
                            <TableRow key={report.id}>
                                <TableCell>
                                    <div className="max-w-72 truncate font-medium">{report.result?.title || report.question || report.id}</div>
                                    {report.errorMessage && <div className="text-destructive mt-1 max-w-72 truncate text-xs">{report.errorMessage}</div>}
                                </TableCell>
                                <TableCell>{reportLabel(report.reportType)}</TableCell>
                                <TableCell><StatusBadge status={report.status} /></TableCell>
                                <TableCell className="max-w-44 truncate font-mono text-xs">{report.userId}</TableCell>
                                <TableCell>{formatCredits(report.costCredits)}</TableCell>
                                <TableCell><TimeText value={report.createdAt} format="YYYY/MM/DD HH:mm" /></TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon-sm" title="查看详情" onClick={() => onOpen(report.id)}>
                                            <Eye className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            title={isBusy(report.status) ? "生成中不可删除" : "删除报告"}
                                            disabled={isBusy(report.status) || deletingId === report.id}
                                            onClick={() => onDelete(report)}
                                        >
                                            <Trash2 className="text-destructive size-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!reports.length && <EmptyRow colSpan={7} text="暂无匹配报告" />}
                    </TableBody>
                </Table>
            </DataTable>

            <PaginationFooter total={total} PaginationComponent={PaginationComponent} />
        </section>
    );
}

function ProfilesPanel({
    filters,
    profiles,
    total,
    loading,
    PaginationComponent,
    onFiltersChange,
    onApplyFilters,
    onResetFilters,
}: {
    filters: ProfileFilters;
    profiles: AstrologyProfile[];
    total: number;
    loading: boolean;
    PaginationComponent: React.FC<{ className?: string }>;
    onFiltersChange: (filters: ProfileFilters) => void;
    onApplyFilters: () => void;
    onResetFilters: () => void;
}) {
    return (
        <section className="rounded-md border bg-card p-4">
            <PanelHeader
                title="用户档案"
                description={`共 ${total} 个档案。这里仅做运营查看，不承载用户端创建流程。`}
                aside={(
                    <Button variant="outline" onClick={onResetFilters}>
                        <RotateCcw className="size-4" />
                        重置
                    </Button>
                )}
            />

            <form
                className="mb-4 grid max-w-2xl gap-3 md:grid-cols-[minmax(160px,1fr)_minmax(220px,1.5fr)_auto]"
                onSubmit={(event) => {
                    event.preventDefault();
                    onApplyFilters();
                }}
            >
                <Input placeholder="用户 ID" value={filters.userId} onChange={(event) => onFiltersChange({ ...filters, userId: event.target.value })} />
                <Input placeholder="档案名称关键词" value={filters.keyword} onChange={(event) => onFiltersChange({ ...filters, keyword: event.target.value })} />
                <Button type="submit">
                    <Search className="size-4" />
                    搜索
                </Button>
            </form>

            <DataTable loading={loading}>
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            <TableHead>档案</TableHead>
                            <TableHead>星座</TableHead>
                            <TableHead>生肖</TableHead>
                            <TableHead>出生信息</TableHead>
                            <TableHead>用户</TableHead>
                            <TableHead>创建时间</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {profiles.map((profile) => (
                            <TableRow key={profile.id}>
                                <TableCell>
                                    <div className="max-w-72 truncate font-medium">{profile.name}</div>
                                    <div className="text-muted-foreground mt-1 max-w-72 truncate text-xs">{profile.birthPlace || "未填写出生地"}</div>
                                </TableCell>
                                <TableCell>{profile.zodiacSign || "-"}</TableCell>
                                <TableCell>{profile.chineseZodiac || "-"}</TableCell>
                                <TableCell>{[profile.birthDate, profile.birthTime].filter(Boolean).join(" ") || "-"}</TableCell>
                                <TableCell className="max-w-44 truncate font-mono text-xs">{profile.userId}</TableCell>
                                <TableCell><TimeText value={profile.createdAt} format="YYYY/MM/DD HH:mm" /></TableCell>
                            </TableRow>
                        ))}
                        {!profiles.length && <EmptyRow colSpan={6} text="暂无档案" />}
                    </TableBody>
                </Table>
            </DataTable>

            <PaginationFooter total={total} PaginationComponent={PaginationComponent} />
        </section>
    );
}

function ReportDetailDialog({
    report,
    loading,
    open,
    onOpenChange,
    onDelete,
}: {
    report: AstrologyReport | null;
    loading: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (report: AstrologyReport) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88vh] overflow-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{report?.result?.title || report?.question || "报告详情"}</DialogTitle>
                    <DialogDescription>{report ? `${reportLabel(report.reportType)} · ${statusLabel(report.status)}` : "正在加载报告详情"}</DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Spinner className="size-8" />
                    </div>
                ) : report ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <Detail label="报告 ID" value={report.id} />
                            <Detail label="用户 ID" value={report.userId} />
                            <Detail label="类型" value={reportLabel(report.reportType)} />
                            <Detail label="状态" value={statusLabel(report.status)} />
                            <Detail label="模型 ID" value={report.modelId} />
                            <Detail label="Provider ID" value={report.providerId} />
                        </div>
                        {report.errorMessage && <div className="text-destructive rounded-md border p-3 text-sm">{report.errorMessage}</div>}
                        <article className="rounded-md bg-muted p-4">
                            <p className="text-sm leading-7">{report.result?.summary || report.resultText || "暂无内容"}</p>
                            {report.result?.sections?.map((section) => (
                                <section key={section.heading} className="mt-4">
                                    <h3 className="font-medium">{section.heading}</h3>
                                    <p className="text-muted-foreground mt-2 text-sm leading-7">{section.content}</p>
                                </section>
                            ))}
                        </article>
                        <DialogFooter>
                            <Button variant="destructive" disabled={isBusy(report.status)} onClick={() => onDelete(report)}>
                                <Trash2 className="size-4" />
                                {isBusy(report.status) ? "生成中不可删除" : "删除报告"}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="text-muted-foreground py-16 text-center">报告不存在</div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function DeleteReportDialog({
    target,
    deleting,
    onOpenChange,
    onConfirm,
}: {
    target: DeleteTarget | null;
    deleting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>删除报告记录</DialogTitle>
                    <DialogDescription>删除后用户端也不可见。处理中记录不会被删除，以避免后台任务继续写回。</DialogDescription>
                </DialogHeader>
                <div className="rounded-md bg-muted p-3 text-sm">
                    {target?.report.result?.title || target?.report.question || target?.report.id || "-"}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>取消</Button>
                    <Button variant="destructive" onClick={onConfirm} loading={deleting}>删除</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PriceField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input type="number" min="0" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-md border bg-card p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">{icon}</div>
            <div>
                <div className="text-muted-foreground text-xs">{label}</div>
                <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
            </div>
        </div>
    );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <Button variant={active ? "secondary" : "ghost"} size="sm" type="button" onClick={onClick}>
            {icon}
            {label}
        </Button>
    );
}

function PanelHeader({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) {
    return (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            </div>
            {aside}
        </div>
    );
}

function DataTable({ loading, children }: { loading: boolean; children: ReactNode }) {
    if (loading) {
        return (
            <div className="mb-4 flex items-center justify-center rounded-md border py-20">
                <Spinner className="size-8" />
            </div>
        );
    }
    return <div className="mb-4 overflow-hidden rounded-md border">{children}</div>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                {text}
            </TableCell>
        </TableRow>
    );
}

function PaginationFooter({ total, PaginationComponent }: { total: number; PaginationComponent: React.FC<{ className?: string }> }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-muted-foreground text-sm">共 {total} 条数据</div>
            <PaginationComponent />
        </div>
    );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-md bg-muted p-3">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="mt-1 break-all text-sm font-medium">{value || "-"}</div>
        </div>
    );
}

function ReportTypeSelect({ value, onChange }: { value: ReportFilters["reportType"]; onChange: (value: ReportFilters["reportType"]) => void }) {
    return (
        <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ReportFilters["reportType"])}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {reportTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function StatusSelect({ value, onChange }: { value: ReportFilters["status"]; onChange: (value: ReportFilters["status"]) => void }) {
    return (
        <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ReportFilters["status"])}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {statusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function FavoriteSelect({ value, onChange }: { value: ReportFilters["isFavorite"]; onChange: (value: ReportFilters["isFavorite"]) => void }) {
    return (
        <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ReportFilters["isFavorite"])}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="全部收藏" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">全部收藏</SelectItem>
                <SelectItem value="true">仅收藏</SelectItem>
                <SelectItem value="false">未收藏</SelectItem>
            </SelectContent>
        </Select>
    );
}

function StatusBadge({ status }: { status: AstrologyReportStatus }) {
    const variant = status === "failed" ? "destructive" : status === "success" ? "default" : "secondary";
    return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function normalizePrice(value: string) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function formatPriceInput(value?: number | string | null) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? String(numberValue) : "0";
}

function formatModelLabel(model: { name?: string; model?: string; providerName?: string; provider?: { name?: string; provider?: string } }) {
    const provider = model.providerName || model.provider?.name || model.provider?.provider || "未知供应商";
    const name = model.name || model.model || "未命名模型";
    const key = model.model && model.model !== name ? ` (${model.model})` : "";
    return `${provider} / ${name}${key}`;
}

function formatModelName(model: { name?: string; model?: string }) {
    return model.name || model.model || "未命名模型";
}

function isBusy(status: AstrologyReportStatus) {
    return status === "pending" || status === "processing";
}

function formatMetricValue(value: number, loading: boolean) {
    return loading ? "--" : String(value);
}

function formatCredits(value?: number | string | null) {
    const numberValue = Number(value ?? 0);
    if (!Number.isFinite(numberValue)) return "0";
    return numberValue.toFixed(4).replace(/\.?0+$/, "");
}

function getErrorMessage(error: unknown, fallback: string) {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    if (typeof responseMessage === "string") return responseMessage;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}
