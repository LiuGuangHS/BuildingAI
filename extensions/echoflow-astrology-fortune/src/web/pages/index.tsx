import { useCopy } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import {
    AlertCircle,
    BookOpen,
    CalendarDays,
    Coins,
    Copy,
    FileText,
    Heart,
    Library,
    Loader2,
    MessageCircle,
    Plus,
    RefreshCw,
    ShieldCheck,
    Star,
    Trash2,
    UserRound,
    Users,
    Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import {
    priceGroupLabel,
    reportIntents,
    reportLabel,
    statusLabel,
    type ReportIntent,
} from "../constants/report-types";
import {
    useAstrologyProfilesQuery,
    useAstrologyReportsQuery,
    useCreateAstrologyProfileMutation,
    useDeleteAstrologyProfileMutation,
    useDeleteAstrologyReportMutation,
    useGenerateAstrologyReportMutation,
    useUpdateAstrologyProfileMutation,
    useUpdateReportFeedbackMutation,
    useUpdateReportFavoriteMutation,
} from "../services/web/astrology-fortune";
import type {
    AstrologyProfile,
    AstrologyProfileInput,
    AstrologyReport,
    AstrologyReportType,
    GenerateAstrologyReportParams,
    UpdateReportFeedbackParams,
} from "../services/types";

type PartnerInput = {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    zodiacSign: string;
    relationshipStatus: string;
};

type WorkView = "today" | "ask" | "relationship" | "profiles" | "reports";

type GenerateOverride = {
    intent?: ReportIntent;
    focusArea?: string;
    currentState?: string;
    question?: string;
    sourceReportId?: string;
};

const defaultIntent = reportIntents[0] as ReportIntent;
const dailyIntent = reportIntents.find((item) => item.value === "daily") ?? defaultIntent;
const relationshipIntent =
    reportIntents.find((item) => item.value === "compatibility") ?? defaultIntent;

const viewOptions: Array<{
    value: WorkView;
    label: string;
    icon: typeof Star;
    description: string;
}> = [
    { value: "today", label: "今日", icon: CalendarDays, description: "快速生成今日建议" },
    { value: "ask", label: "问问", icon: MessageCircle, description: "针对问题生成报告" },
    { value: "relationship", label: "关系", icon: Users, description: "双人配对和沟通建议" },
    { value: "profiles", label: "档案", icon: UserRound, description: "维护出生信息" },
    { value: "reports", label: "报告", icon: Library, description: "查看历史与收藏" },
];

const defaultProfile: AstrologyProfileInput = {
    name: "我的星盘",
    birthDate: "1996-08-18",
    birthTime: "09:30",
    birthPlace: "上海",
    gender: "",
    moonSign: "",
    risingSign: "",
};

const defaultPartner: PartnerInput = {
    name: "TA",
    birthDate: "1997-02-14",
    birthTime: "",
    birthPlace: "",
    zodiacSign: "",
    relationshipStatus: "暧昧中",
};

const HISTORY_PAGE_SIZE = 12;

export default function AstrologyFortuneHomePage() {
    const { copy } = useCopy();
    const [activeView, setActiveView] = useState<WorkView>("today");
    const [profileForm, setProfileForm] = useState<AstrologyProfileInput>(defaultProfile);
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [reportType, setReportType] = useState<AstrologyReportType>("daily");
    const [focusArea, setFocusArea] = useState(defaultIntent.focusArea);
    const [currentState, setCurrentState] = useState(defaultIntent.currentState);
    const [question, setQuestion] = useState(defaultIntent.question);
    const [partner, setPartner] = useState<PartnerInput>(defaultPartner);
    const [activeReport, setActiveReport] = useState<AstrologyReport | null>(null);
    const [detailReport, setDetailReport] = useState<AstrologyReport | null>(null);
    const [followUpSourceReportId, setFollowUpSourceReportId] = useState<string | null>(null);
    const [historyType, setHistoryType] = useState<AstrologyReportType | "all" | "favorite">("all");
    const [historyPage, setHistoryPage] = useState(1);

    const profilesQuery = useAstrologyProfilesQuery();
    const reportsQuery = useAstrologyReportsQuery({
        page: historyPage,
        pageSize: HISTORY_PAGE_SIZE,
        reportType: historyType !== "all" && historyType !== "favorite" ? historyType : undefined,
        isFavorite: historyType === "favorite" ? true : undefined,
    });
    const createProfileMutation = useCreateAstrologyProfileMutation();
    const updateProfileMutation = useUpdateAstrologyProfileMutation();
    const deleteProfileMutation = useDeleteAstrologyProfileMutation();
    const generateReportMutation = useGenerateAstrologyReportMutation();
    const favoriteMutation = useUpdateReportFavoriteMutation();
    const feedbackMutation = useUpdateReportFeedbackMutation();
    const deleteReportMutation = useDeleteAstrologyReportMutation();

    const profiles = profilesQuery.data?.items ?? [];
    const reports = reportsQuery.data?.items ?? [];
    const selectedProfile =
        profiles.find((item) => item.id === selectedProfileId) ?? profiles[0] ?? null;
    const latestSuccessfulReport = reports.find((item) => item.status === "success" && item.result);
    const latestDailyReport = reports.find(
        (item) => item.reportType === "daily" && item.status === "success" && item.result,
    );
    const latestCompatibilityReport = reports.find(
        (item) => item.reportType === "compatibility" && item.status === "success" && item.result,
    );
    const currentReport = activeReport ?? latestSuccessfulReport ?? null;
    const currentIntent = reportIntents.find((item) => item.value === reportType) ?? defaultIntent;
    const busy =
        createProfileMutation.isPending ||
        updateProfileMutation.isPending ||
        generateReportMutation.isPending;
    const profileStats = useMemo(
        () => ({
            total: profiles.length,
            favoriteReports: reports.filter((item) => item.isFavorite).length,
        }),
        [profiles.length, reports],
    );
    const profileCompletion = useMemo(
        () => calculateProfileCompletion(selectedProfile ?? profileForm),
        [selectedProfile, profileForm],
    );
    const dataUnavailable = profilesQuery.isError || reportsQuery.isError;
    const historyPagination = usePagination({
        total: reportsQuery.data?.total ?? 0,
        pageSize: reportsQuery.data?.pageSize ?? HISTORY_PAGE_SIZE,
        page: historyPage,
        onPageChange: setHistoryPage,
    });

    useEffect(() => {
        if (!selectedProfileId && profiles[0]) setSelectedProfileId(profiles[0].id);
    }, [profiles, selectedProfileId]);

    useEffect(() => {
        if (!activeReport && latestSuccessfulReport) setActiveReport(latestSuccessfulReport);
    }, [activeReport, latestSuccessfulReport]);

    useEffect(() => {
        if (!activeReport) return;
        const freshReport = reports.find((item) => item.id === activeReport.id);
        if (freshReport && freshReport.updatedAt !== activeReport.updatedAt)
            setActiveReport(freshReport);
    }, [activeReport, reports]);

    useEffect(() => {
        if (!detailReport) return;
        const freshReport = reports.find((item) => item.id === detailReport.id);
        if (freshReport && freshReport.updatedAt !== detailReport.updatedAt)
            setDetailReport(freshReport);
    }, [detailReport, reports]);

    function selectIntent(intent: ReportIntent) {
        setReportType(intent.value);
        setFocusArea(intent.focusArea);
        setCurrentState(intent.currentState);
        setQuestion(intent.question);
        setFollowUpSourceReportId(null);
    }

    function editProfile(profile: AstrologyProfile) {
        setActiveView("profiles");
        setEditingProfileId(profile.id);
        setProfileForm({
            name: profile.name,
            birthDate: profile.birthDate,
            birthTime: profile.birthTime ?? "",
            birthPlace: profile.birthPlace ?? "",
            gender: profile.gender ?? "",
            zodiacSign: profile.zodiacSign,
            moonSign: profile.moonSign ?? "",
            risingSign: profile.risingSign ?? "",
        });
    }

    function resetProfileForm() {
        setEditingProfileId(null);
        setProfileForm(defaultProfile);
    }

    async function handleSaveProfile(event: FormEvent) {
        event.preventDefault();
        try {
            const saved = editingProfileId
                ? await updateProfileMutation.mutateAsync({
                      profileId: editingProfileId,
                      params: profileForm,
                  })
                : await createProfileMutation.mutateAsync(profileForm);
            setSelectedProfileId(saved.id);
            toast.success(editingProfileId ? "档案已更新" : "档案已创建");
            resetProfileForm();
        } catch (error) {
            toast.error(getErrorMessage(error, "档案保存失败"));
        }
    }

    async function handleDeleteProfile(profileId: string) {
        try {
            await deleteProfileMutation.mutateAsync(profileId);
            if (selectedProfileId === profileId) setSelectedProfileId(null);
            toast.success("档案已删除");
        } catch (error) {
            toast.error(getErrorMessage(error, "档案删除失败"));
        }
    }

    async function handleGenerateReport(event?: FormEvent, override?: GenerateOverride) {
        event?.preventDefault();
        const intent = override?.intent ?? currentIntent;
        try {
            const profile =
                selectedProfile ?? (await createProfileMutation.mutateAsync(profileForm));
            setSelectedProfileId(profile.id);
            const nextQuestion = override?.question ?? question;
            const params: GenerateAstrologyReportParams = {
                reportType: intent.value,
                profileId: profile.id,
                focusArea: override?.focusArea ?? focusArea,
                currentState: override?.currentState ?? currentState,
                question: nextQuestion,
                language: "zh-CN",
                sourceReportId: override?.sourceReportId ?? followUpSourceReportId ?? undefined,
            };
            if (intent.value === "compatibility") {
                params.targetProfile = partner;
                params.question = `${nextQuestion}\n关系状态：${partner.relationshipStatus}\n对方：${partner.name}，生日：${partner.birthDate}，星座：${partner.zodiacSign || "请自动推算"}，出生地：${partner.birthPlace || "未填写"}`;
            }
            const report = await generateReportMutation.mutateAsync(params);
            setReportType(intent.value);
            setActiveReport(report);
            setDetailReport(report);
            setFollowUpSourceReportId(null);
            toast.success("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            toast.error(getErrorMessage(error, "报告生成失败"));
        }
    }

    async function handleRegenerate(report: AstrologyReport) {
        const intent =
            reportIntents.find((item) => item.value === report.reportType) ?? currentIntent;
        selectIntent(intent);
        setHistoryType("all");
        try {
            const regenerated = await generateReportMutation.mutateAsync({
                reportType: report.reportType,
                profileId: report.profileId ?? selectedProfile?.id ?? undefined,
                focusArea: report.tags?.[1],
                question: report.question ?? undefined,
                language: "zh-CN",
            });
            setActiveReport(regenerated);
            setDetailReport(regenerated);
            toast.success("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            toast.error(getErrorMessage(error, "重新生成失败"));
        }
    }

    async function handleDeleteReport(reportId: string) {
        try {
            await deleteReportMutation.mutateAsync(reportId);
            if (activeReport?.id === reportId) setActiveReport(null);
            if (detailReport?.id === reportId) setDetailReport(null);
            toast.success("报告已删除");
        } catch (error) {
            toast.error(getErrorMessage(error, "报告删除失败"));
        }
    }

    async function copyReport(report: AstrologyReport) {
        await copy(report.resultText || report.result?.summary || "");
        toast.success("报告内容已复制");
    }

    function prepareFollowUp(report: AstrologyReport, prompt: string) {
        const intent =
            reportIntents.find((item) => item.value === report.reportType) ?? defaultIntent;
        const reportTitle =
            report.result?.title || report.question || reportLabel(report.reportType);
        setActiveView("ask");
        setReportType(intent.value);
        setFocusArea(`基于「${reportLabel(report.reportType)}」继续细化`);
        setCurrentState("已经生成过一份报告，希望把结论转成更具体的下一步。");
        setQuestion(prompt.replace("{title}", reportTitle));
        setActiveReport(report);
        setFollowUpSourceReportId(report.id);
        toast.success("已带入追问问题，可继续生成新报告");
    }

    async function handleFavorite(report: AstrologyReport) {
        try {
            await favoriteMutation.mutateAsync({
                reportId: report.id,
                isFavorite: !report.isFavorite,
            });
            toast.success(report.isFavorite ? "已取消收藏" : "已收藏报告");
        } catch (error) {
            toast.error(getErrorMessage(error, "收藏操作失败"));
        }
    }

    async function handleFeedback(
        report: AstrologyReport,
        rating: UpdateReportFeedbackParams["rating"],
    ) {
        try {
            const updatedReport = await feedbackMutation.mutateAsync({
                reportId: report.id,
                params: { rating },
            });
            if (activeReport?.id === updatedReport.id) setActiveReport(updatedReport);
            if (detailReport?.id === updatedReport.id) setDetailReport(updatedReport);
            toast.success("反馈已记录，会用于后续优化报告质量");
        } catch (error) {
            toast.error(getErrorMessage(error, "反馈保存失败"));
        }
    }

    function changeHistoryType(type: AstrologyReportType | "all" | "favorite") {
        setHistoryType(type);
        setHistoryPage(1);
    }

    return (
        <main className="astro-shell">
            <style>{styles}</style>
            <section className="astro-page">
                <AppHeader
                    profile={selectedProfile}
                    profileStats={profileStats}
                    reportCount={reportsQuery.data?.total ?? reports.length}
                    report={currentReport}
                    completion={profileCompletion}
                    onOpenProfiles={() => setActiveView("profiles")}
                />

                {dataUnavailable && <DataStatusNotice />}

                <WorkTabs activeView={activeView} onChange={setActiveView} />

                {activeView === "today" && (
                    <TodayView
                        profile={selectedProfile}
                        completion={profileCompletion}
                        report={
                            activeReport?.reportType === "daily"
                                ? activeReport
                                : (latestDailyReport ?? currentReport)
                        }
                        busy={busy}
                        onGenerate={() =>
                            handleGenerateReport(undefined, {
                                intent: dailyIntent,
                                focusArea: dailyIntent.focusArea,
                                currentState: currentState || dailyIntent.currentState,
                                question: question || dailyIntent.question,
                            })
                        }
                        onOpenProfile={() => setActiveView("profiles")}
                        onOpenReport={setDetailReport}
                        onFavorite={handleFavorite}
                        onCopy={copyReport}
                        onDelete={handleDeleteReport}
                        onRegenerate={handleRegenerate}
                        onFollowUp={prepareFollowUp}
                        onFeedback={handleFeedback}
                    />
                )}

                {activeView === "ask" && (
                    <section className="work-grid">
                        <ReportComposer
                            intent={currentIntent}
                            intents={reportIntents}
                            reportType={reportType}
                            selectedProfile={selectedProfile}
                            profileCompletion={profileCompletion}
                            focusArea={focusArea}
                            currentState={currentState}
                            question={question}
                            partner={partner}
                            busy={busy}
                            onFocusAreaChange={setFocusArea}
                            onCurrentStateChange={setCurrentState}
                            onQuestionChange={setQuestion}
                            onPartnerChange={setPartner}
                            onIntentChange={selectIntent}
                            onSubmit={(event) => handleGenerateReport(event)}
                            onOpenProfiles={() => setActiveView("profiles")}
                        />
                        <div className="side-stack">
                            <GenerationValuePanel
                                intent={currentIntent}
                                profile={selectedProfile}
                                completion={profileCompletion}
                                question={question}
                                partner={
                                    currentIntent.value === "compatibility" ? partner : undefined
                                }
                            />
                            <ReportPanel
                                report={currentReport}
                                onFavorite={handleFavorite}
                                onCopy={copyReport}
                                onOpen={setDetailReport}
                                onDelete={handleDeleteReport}
                                onRegenerate={handleRegenerate}
                                onFollowUp={prepareFollowUp}
                                onFeedback={handleFeedback}
                            />
                        </div>
                    </section>
                )}

                {activeView === "relationship" && (
                    <section className="work-grid">
                        <RelationshipPanel
                            partner={partner}
                            profile={selectedProfile}
                            busy={busy}
                            onPartnerChange={setPartner}
                            onOpenProfiles={() => setActiveView("profiles")}
                            onGenerate={() =>
                                handleGenerateReport(undefined, {
                                    intent: relationshipIntent,
                                    focusArea: relationshipIntent.focusArea,
                                    currentState: partner.relationshipStatus,
                                    question: relationshipIntent.question,
                                })
                            }
                        />
                        <div className="side-stack">
                            <GenerationValuePanel
                                intent={relationshipIntent}
                                profile={selectedProfile}
                                completion={profileCompletion}
                                question={relationshipIntent.question}
                                partner={partner}
                            />
                            <ReportPanel
                                report={
                                    activeReport?.reportType === "compatibility"
                                        ? activeReport
                                        : (latestCompatibilityReport ?? currentReport)
                                }
                                onFavorite={handleFavorite}
                                onCopy={copyReport}
                                onOpen={setDetailReport}
                                onDelete={handleDeleteReport}
                                onRegenerate={handleRegenerate}
                                onFollowUp={prepareFollowUp}
                                onFeedback={handleFeedback}
                            />
                        </div>
                    </section>
                )}

                {activeView === "profiles" && (
                    <ProfileManager
                        profiles={profiles}
                        selectedProfileId={selectedProfile?.id ?? null}
                        profileForm={profileForm}
                        editingProfileId={editingProfileId}
                        busy={busy}
                        onSelect={setSelectedProfileId}
                        onEdit={editProfile}
                        onDelete={handleDeleteProfile}
                        onReset={resetProfileForm}
                        onSubmit={handleSaveProfile}
                        onChange={setProfileForm}
                    />
                )}

                {activeView === "reports" && (
                    <section className="work-grid">
                        <HistoryPanel
                            reports={reports}
                            total={reportsQuery.data?.total ?? 0}
                            activeType={historyType}
                            PaginationComponent={historyPagination.PaginationComponent}
                            onTypeChange={changeHistoryType}
                            onOpen={setDetailReport}
                        />
                        <ReportPanel
                            report={currentReport}
                            onFavorite={handleFavorite}
                            onCopy={copyReport}
                            onOpen={setDetailReport}
                            onDelete={handleDeleteReport}
                            onRegenerate={handleRegenerate}
                            onFollowUp={prepareFollowUp}
                            onFeedback={handleFeedback}
                        />
                    </section>
                )}
            </section>

            <ReportDetailModal
                report={detailReport}
                onClose={() => setDetailReport(null)}
                onCopy={copyReport}
                onFavorite={handleFavorite}
                onDelete={handleDeleteReport}
                onRegenerate={handleRegenerate}
                onFollowUp={prepareFollowUp}
                onFeedback={handleFeedback}
            />
        </main>
    );
}

function DataStatusNotice() {
    return (
        <div className="data-status">
            <AlertCircle size={15} />
            <span>本地数据暂不可用，页面已切换为空状态。生成和保存需要主服务连接正常。</span>
        </div>
    );
}

function AppHeader({
    profile,
    profileStats,
    reportCount,
    report,
    completion,
    onOpenProfiles,
}: {
    profile: AstrologyProfile | null;
    profileStats: { total: number; favoriteReports: number };
    reportCount: number;
    report: AstrologyReport | null;
    completion: ProfileCompletion;
    onOpenProfiles: () => void;
}) {
    return (
        <header className="app-header">
            <div
                className="header-panel"
                role="button"
                tabIndex={0}
                onClick={onOpenProfiles}
                onKeyDown={(event) => {
                    if (event.key === "Enter") onOpenProfiles();
                }}
            >
                <div className="profile-main">
                    <UserRound size={16} />
                    <strong>{profile?.name || "未创建档案"}</strong>
                    <span>
                        {profile
                            ? `${profile.zodiacSign} · ${profile.birthDate}`
                            : "生成前先保存基础信息"}
                    </span>
                </div>
                <div className="header-stats">
                    <span>完整度 {completion.percent}%</span>
                    <span>档案 {profileStats.total}</span>
                    <span>报告 {reportCount}</span>
                    {profileStats.favoriteReports > 0 && (
                        <span>收藏 {profileStats.favoriteReports}</span>
                    )}
                    <span>{report ? statusLabel(report.status) : "未生成"}</span>
                    <b>{profile ? "完善" : "创建"}</b>
                </div>
            </div>
        </header>
    );
}

function WorkTabs({
    activeView,
    onChange,
}: {
    activeView: WorkView;
    onChange: (view: WorkView) => void;
}) {
    return (
        <Tabs
            value={activeView}
            onValueChange={(value) => onChange(value as WorkView)}
            className="work-tabs"
        >
            <TabsList className="work-tabs-list" variant="line">
                {viewOptions.map((item) => {
                    const Icon = item.icon;
                    return (
                        <TabsTrigger key={item.value} value={item.value} className="work-tab">
                            <Icon size={17} />
                            <span>{item.label}</span>
                            <small>{item.description}</small>
                        </TabsTrigger>
                    );
                })}
            </TabsList>
        </Tabs>
    );
}

function TodayView({
    profile,
    completion,
    report,
    busy,
    onGenerate,
    onOpenProfile,
    onOpenReport,
    onFavorite,
    onCopy,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
}: {
    profile: AstrologyProfile | null;
    completion: ProfileCompletion;
    report: AstrologyReport | null;
    busy: boolean;
    onGenerate: () => void;
    onOpenProfile: () => void;
    onOpenReport: (report: AstrologyReport) => void;
    onFavorite: (report: AstrologyReport) => void;
    onCopy: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: (report: AstrologyReport, rating: UpdateReportFeedbackParams["rating"]) => void;
}) {
    return (
        <section className="today-layout">
            <div className="daily-panel">
                <div className="daily-head">
                    <div>
                        <div className="panel-kicker">
                            <CalendarDays size={15} /> 今日
                        </div>
                        <h2>今天先看哪里</h2>
                        <p>结合档案和当前状态，生成一份行动化的今日建议。</p>
                    </div>
                    <CostHint intent={dailyIntent} compact />
                </div>
                <div className="context-row">
                    <span>参考</span>
                    <strong>
                        {profile ? `${profile.name} / ${profile.zodiacSign}` : "生成时自动创建档案"}
                    </strong>
                    <span>完整度 {completion.percent}%</span>
                    <span>{report ? `最近：${statusLabel(report.status)}` : "还没有今日报告"}</span>
                </div>
                <div className="primary-actions">
                    <Button
                        className="astro-primary"
                        loading={busy}
                        disabled={busy}
                        onClick={onGenerate}
                        type="button"
                    >
                        <CalendarDays size={16} />
                        生成今日建议
                    </Button>
                    <Button
                        className="astro-secondary"
                        variant="outline"
                        onClick={onOpenProfile}
                        type="button"
                    >
                        <UserRound size={16} />
                        完善档案
                    </Button>
                </div>
                <div className="ai-cue">
                    <Wand2 size={15} />
                    <span>生成后可继续追问执行细节，反馈会影响后续报告的取舍和表达。</span>
                </div>
            </div>

            <div className="side-stack">
                <ProfileReadiness
                    profile={profile}
                    completion={completion}
                    onOpenProfile={onOpenProfile}
                />
                <ReportPanel
                    report={report}
                    compact
                    onFavorite={onFavorite}
                    onCopy={onCopy}
                    onOpen={onOpenReport}
                    onDelete={onDelete}
                    onRegenerate={onRegenerate}
                    onFollowUp={onFollowUp}
                    onFeedback={onFeedback}
                />
            </div>
        </section>
    );
}

function ReportComposer(props: {
    intent: ReportIntent;
    intents: ReportIntent[];
    reportType: AstrologyReportType;
    selectedProfile: AstrologyProfile | null;
    profileCompletion: ProfileCompletion;
    focusArea: string;
    currentState: string;
    question: string;
    partner: PartnerInput;
    busy: boolean;
    onFocusAreaChange: (value: string) => void;
    onCurrentStateChange: (value: string) => void;
    onQuestionChange: (value: string) => void;
    onPartnerChange: (value: PartnerInput) => void;
    onIntentChange: (intent: ReportIntent) => void;
    onSubmit: (event: FormEvent) => void;
    onOpenProfiles: () => void;
}) {
    const Icon = props.intent.icon;
    return (
        <form className="panel composer-panel" onSubmit={props.onSubmit}>
            <div className="panel-heading">
                <div className="panel-icon">
                    <Icon size={18} />
                </div>
                <div>
                    <div className="panel-kicker">定向解读</div>
                    <h2>问一个具体问题</h2>
                    <p>把当前处境说清楚，报告会更像建议，而不是泛泛的运势。</p>
                </div>
            </div>

            <div className="intent-strip">
                {props.intents.map((intent) => (
                    <IntentButton
                        key={intent.value}
                        intent={intent}
                        active={props.reportType === intent.value}
                        onClick={() => props.onIntentChange(intent)}
                    />
                ))}
            </div>

            <div className="context-strip">
                <span>当前档案</span>
                <strong>{props.selectedProfile?.name || "生成时自动创建"}</strong>
                <Button
                    className="astro-secondary"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={props.onOpenProfiles}
                >
                    档案完整度 {props.profileCompletion.percent}%
                </Button>
            </div>

            <div className="form-section two-cols">
                <TextField
                    label="关注方向"
                    value={props.focusArea}
                    onChange={props.onFocusAreaChange}
                />
                <TextField
                    label="当前状态"
                    value={props.currentState}
                    onChange={props.onCurrentStateChange}
                />
            </div>

            {props.reportType === "compatibility" && (
                <PartnerFields partner={props.partner} onChange={props.onPartnerChange} />
            )}

            {props.reportType === "decision" && (
                <div className="template-row">
                    {[
                        "要不要继续推进这段关系？",
                        "这份工作机会现在适合我吗？",
                        "未来一周我应该先处理什么？",
                    ].map((item) => (
                        <Template key={item} onClick={() => props.onQuestionChange(item)}>
                            {item}
                        </Template>
                    ))}
                </div>
            )}

            <div className="form-section">
                <Label className="astro-label">具体问题</Label>
                <Textarea
                    className="astro-control min-h-28"
                    value={props.question}
                    onChange={(event) => props.onQuestionChange(event.target.value)}
                />
            </div>

            <div className="ai-cue">
                <MessageCircle size={15} />
                <span>问题越具体越少走弯路。生成后可以带着本次报告继续追问。</span>
            </div>

            <GenerationFooter intent={props.intent} busy={props.busy} />
        </form>
    );
}

function RelationshipPanel({
    partner,
    profile,
    busy,
    onPartnerChange,
    onGenerate,
    onOpenProfiles,
}: {
    partner: PartnerInput;
    profile: AstrologyProfile | null;
    busy: boolean;
    onPartnerChange: (partner: PartnerInput) => void;
    onGenerate: () => void;
    onOpenProfiles: () => void;
}) {
    return (
        <section className="panel">
            <div className="panel-heading">
                <div className="panel-icon">
                    <Heart size={18} />
                </div>
                <div>
                    <div className="panel-kicker">关系解读</div>
                    <h2>对象、状态和问题</h2>
                    <p>先保存关系对象，再生成吸引力、冲突点和沟通建议。</p>
                </div>
            </div>
            <div className="context-strip">
                <span>我的档案</span>
                <strong>{profile?.name || "未选择档案"}</strong>
                <Button
                    className="astro-secondary"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onOpenProfiles}
                >
                    切换或完善
                </Button>
            </div>
            <div className="relationship-summary">
                <strong>{partner.name || "TA"}</strong>
                <span>{partner.relationshipStatus || "关系状态待补充"}</span>
                <span>
                    {partner.birthDate
                        ? `${partner.birthDate}${partner.zodiacSign ? ` · ${partner.zodiacSign}` : ""}`
                        : "生日可选，但补充后更准"}
                </span>
            </div>
            <PartnerFields partner={partner} onChange={onPartnerChange} />
            <div className="relation-note">
                <BookOpen size={16} />
                <span>出生时间缺失也可以生成；补充后会增强宫位和相处节奏判断。</span>
            </div>
            <div className="generation-footer">
                <CostHint intent={relationshipIntent} />
                <Button
                    className="astro-primary"
                    loading={busy}
                    disabled={busy}
                    onClick={onGenerate}
                    type="button"
                >
                    <Heart size={16} />
                    生成关系分析
                </Button>
            </div>
        </section>
    );
}

function PartnerFields({
    partner,
    onChange,
}: {
    partner: PartnerInput;
    onChange: (partner: PartnerInput) => void;
}) {
    return (
        <div className="form-section two-cols">
            <TextField
                label="对方称呼"
                value={partner.name}
                onChange={(value) => onChange({ ...partner, name: value })}
            />
            <TextField
                label="出生日期"
                value={partner.birthDate}
                type="date"
                onChange={(value) => onChange({ ...partner, birthDate: value })}
            />
            <TextField
                label="出生时间"
                value={partner.birthTime}
                type="time"
                onChange={(value) => onChange({ ...partner, birthTime: value })}
            />
            <TextField
                label="出生地点"
                value={partner.birthPlace}
                onChange={(value) => onChange({ ...partner, birthPlace: value })}
                placeholder="可选"
            />
            <TextField
                label="星座"
                value={partner.zodiacSign}
                onChange={(value) => onChange({ ...partner, zodiacSign: value })}
                placeholder="留空自动推算"
            />
            <TextField
                label="关系状态"
                value={partner.relationshipStatus}
                onChange={(value) => onChange({ ...partner, relationshipStatus: value })}
            />
        </div>
    );
}

function ProfileManager(props: {
    profiles: AstrologyProfile[];
    selectedProfileId: string | null;
    profileForm: AstrologyProfileInput;
    editingProfileId: string | null;
    busy: boolean;
    onSelect: (id: string) => void;
    onEdit: (profile: AstrologyProfile) => void;
    onDelete: (id: string) => void;
    onReset: () => void;
    onSubmit: (event: FormEvent) => void;
    onChange: (profile: AstrologyProfileInput) => void;
}) {
    return (
        <section className="profile-layout">
            <div className="panel">
                <div className="panel-heading compact-heading">
                    <div>
                        <div className="panel-kicker">星盘档案</div>
                        <h2>选择生成依据</h2>
                        <p>档案是报告的长期记忆，不需要每次重新填写。</p>
                    </div>
                    <Button
                        className="astro-secondary"
                        variant="outline"
                        onClick={props.onReset}
                        type="button"
                    >
                        <Plus size={16} /> 新档案
                    </Button>
                </div>
                <div className="profile-list">
                    {props.profiles.map((profile) => (
                        <Button
                            key={profile.id}
                            className={`profile-card ${props.selectedProfileId === profile.id ? "active" : ""}`}
                            variant="ghost"
                            onClick={() => props.onSelect(profile.id)}
                            type="button"
                        >
                            <div>
                                <strong>{profile.name}</strong>
                                <span>
                                    {profile.zodiacSign} · 生肖{profile.chineseZodiac}
                                </span>
                                <small>
                                    {profile.birthDate} {profile.birthPlace || ""}
                                </small>
                            </div>
                            <div className="mini-actions">
                                <span
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        props.onEdit(profile);
                                    }}
                                >
                                    编辑
                                </span>
                                <span
                                    className="danger"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        props.onDelete(profile.id);
                                    }}
                                >
                                    删
                                </span>
                            </div>
                        </Button>
                    ))}
                    {!props.profiles.length && (
                        <EmptyState
                            title="还没有档案"
                            text="创建第一个档案后，就可以用它生成今日运势和关系报告。"
                        />
                    )}
                </div>
            </div>

            <form className="panel" onSubmit={props.onSubmit}>
                <div className="panel-heading compact-heading">
                    <div>
                        <div className="panel-kicker">
                            {props.editingProfileId ? "编辑档案" : "新建档案"}
                        </div>
                        <h2>{props.editingProfileId ? "更新出生信息" : "创建生成基础"}</h2>
                        <p>先填基础项即可开始生成，星座细节可以之后补。</p>
                    </div>
                </div>
                <div className="form-group-title">基础信息</div>
                <div className="two-cols">
                    <TextField
                        label="姓名/档案名"
                        value={props.profileForm.name}
                        onChange={(value) => props.onChange({ ...props.profileForm, name: value })}
                    />
                    <TextField
                        label="出生日期"
                        value={props.profileForm.birthDate}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, birthDate: value })
                        }
                        type="date"
                    />
                    <TextField
                        label="出生时间"
                        value={props.profileForm.birthTime || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, birthTime: value })
                        }
                        type="time"
                    />
                    <TextField
                        label="出生地点"
                        value={props.profileForm.birthPlace || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, birthPlace: value })
                        }
                    />
                    <TextField
                        label="性别"
                        value={props.profileForm.gender || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, gender: value })
                        }
                        placeholder="可选"
                    />
                </div>
                <div className="form-group-title">增强项</div>
                <div className="two-cols compact-fields">
                    <TextField
                        label="太阳星座"
                        value={props.profileForm.zodiacSign || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, zodiacSign: value })
                        }
                        placeholder="留空自动推算"
                    />
                    <TextField
                        label="月亮星座"
                        value={props.profileForm.moonSign || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, moonSign: value })
                        }
                        placeholder="可选"
                    />
                    <TextField
                        label="上升星座"
                        value={props.profileForm.risingSign || ""}
                        onChange={(value) =>
                            props.onChange({ ...props.profileForm, risingSign: value })
                        }
                        placeholder="可选"
                    />
                </div>
                <Button
                    className="astro-primary form-submit"
                    disabled={props.busy}
                    loading={props.busy}
                    type="submit"
                >
                    {props.editingProfileId ? "保存档案" : "创建档案"}
                </Button>
            </form>
        </section>
    );
}

function HistoryPanel({
    reports,
    total,
    activeType,
    PaginationComponent,
    onTypeChange,
    onOpen,
}: {
    reports: AstrologyReport[];
    total: number;
    activeType: AstrologyReportType | "all" | "favorite";
    PaginationComponent: React.FC<{ className?: string }>;
    onTypeChange: (type: AstrologyReportType | "all" | "favorite") => void;
    onOpen: (report: AstrologyReport) => void;
}) {
    return (
        <section className="panel">
            <div className="panel-heading compact-heading">
                <div>
                    <div className="panel-kicker">报告库</div>
                    <h2>历史报告</h2>
                    <p>
                        {total
                            ? `共 ${total} 份，可按类型和收藏筛选。`
                            : "生成第一份后，这里会沉淀可复看的记录。"}
                    </p>
                </div>
                <Select
                    value={activeType}
                    onValueChange={(value) =>
                        onTypeChange(value as AstrologyReportType | "all" | "favorite")
                    }
                >
                    <SelectTrigger className="astro-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="favorite">收藏</SelectItem>
                        {reportIntents.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="history-list">
                {reports.map((report) => (
                    <Button
                        key={report.id}
                        className="history-card"
                        variant="ghost"
                        onClick={() => onOpen(report)}
                        type="button"
                    >
                        <div>
                            <strong>
                                {report.result?.title ||
                                    report.question ||
                                    reportLabel(report.reportType)}
                            </strong>
                            <span>
                                {reportLabel(report.reportType)} ·{" "}
                                <TimeText value={report.createdAt} format="YYYY/MM/DD HH:mm" /> ·{" "}
                                {statusLabel(report.status)}
                            </span>
                        </div>
                        <div className="history-score">
                            <b>{report.score ?? "--"}</b>
                            {report.isFavorite && <small>收藏</small>}
                        </div>
                    </Button>
                ))}
                {!reports.length && (
                    <EmptyState
                        title="暂无报告"
                        text="生成第一份报告后，会在这里沉淀成可复看的记录。"
                    />
                )}
            </div>
            {total > HISTORY_PAGE_SIZE && (
                <div className="pagination-row">
                    <PaginationComponent />
                </div>
            )}
        </section>
    );
}

function ReportPanel({
    report,
    compact,
    onFavorite,
    onCopy,
    onOpen,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
}: {
    report: AstrologyReport | null;
    compact?: boolean;
    onFavorite: (report: AstrologyReport) => void;
    onCopy: (report: AstrologyReport) => void;
    onOpen: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: (report: AstrologyReport, rating: UpdateReportFeedbackParams["rating"]) => void;
}) {
    const result = report?.result;
    const isRunning = report?.status === "pending" || report?.status === "processing";
    const isFailed = report?.status === "failed";
    return (
        <section className={`report-panel ${compact ? "compact" : ""}`}>
            <div className="report-head">
                <div>
                    <div className="panel-kicker">
                        <FileText size={14} /> 当前报告
                    </div>
                    <h2>
                        {result?.title ||
                            (isRunning ? "正在生成" : isFailed ? "生成失败" : "等待第一份报告")}
                    </h2>
                    {report && (
                        <p>
                            {reportLabel(report.reportType)} · {statusLabel(report.status)} · 扣费{" "}
                            {formatCredits(report.costCredits)}
                        </p>
                    )}
                </div>
                {report && (
                    <Button
                        className="astro-secondary"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpen(report)}
                        type="button"
                    >
                        详情
                    </Button>
                )}
            </div>

            {result ? (
                <div className="report-content">
                    <p className="report-summary">{result.summary}</p>
                    <div className="keyword-row">
                        {result.keywords?.slice(0, 6).map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>
                    {result.sections?.slice(0, compact ? 1 : 2).map((section) => (
                        <article key={section.heading} className="report-section">
                            <h3>{section.heading}</h3>
                            <p>{section.content}</p>
                        </article>
                    ))}
                    <ActionList items={result.actions ?? []} compact={compact} />
                    <FollowUpPanel report={report} compact={compact} onFollowUp={onFollowUp} />
                    <FeedbackPanel report={report} compact={compact} onFeedback={onFeedback} />
                    {!compact && (
                        <>
                            <div className="metric-grid">
                                {Object.entries(result.scores ?? {})
                                    .slice(0, 6)
                                    .map(([key, value]) => (
                                        <Metric
                                            key={key}
                                            label={scoreLabel(key)}
                                            value={`${Math.round(value)}%`}
                                        />
                                    ))}
                            </div>
                            <div className="lucky-grid">
                                <Lucky label="幸运色" value={result.lucky?.color} />
                                <Lucky label="幸运数字" value={result.lucky?.number?.toString()} />
                                <Lucky label="方位" value={result.lucky?.direction} />
                                <Lucky label="时间段" value={result.lucky?.timeRange} />
                            </div>
                        </>
                    )}
                    <div className="action-row">
                        <Action onClick={() => onCopy(report)}>
                            <Copy size={14} />
                            复制
                        </Action>
                        <Action onClick={() => onFavorite(report)}>
                            {report.isFavorite ? "取消收藏" : "收藏"}
                        </Action>
                        <Action onClick={() => onRegenerate(report)}>
                            <RefreshCw size={14} />
                            重生成
                        </Action>
                        <Action danger onClick={() => onDelete(report.id)}>
                            <Trash2 size={14} />
                            删除
                        </Action>
                    </div>
                </div>
            ) : isRunning && report ? (
                <StatusBox
                    icon={<Loader2 className="animate-spin" size={24} />}
                    title="任务已提交"
                    text="这次调用已经进入任务队列。生成完成后，报告会出现在当前卡片和报告库里。"
                />
            ) : isFailed && report ? (
                <StatusBox
                    danger
                    title="这次生成没有完成"
                    text={
                        report.errorMessage ||
                        "模型或队列暂时不可用。失败任务会按账务事实退款，可稍后重试。"
                    }
                >
                    <Action onClick={() => onRegenerate(report)}>
                        <RefreshCw size={14} />
                        重试
                    </Action>
                    <Action danger onClick={() => onDelete(report.id)}>
                        <Trash2 size={14} />
                        删除
                    </Action>
                </StatusBox>
            ) : (
                <EmptyState
                    title="还没有可展示的报告"
                    text="在当前工作区提交生成后，这里会展示摘要、行动建议和关键提醒。"
                />
            )}
        </section>
    );
}

function GenerationValuePanel({
    intent,
    profile,
    completion,
    question,
    partner,
}: {
    intent: ReportIntent;
    profile: AstrologyProfile | null;
    completion: ProfileCompletion;
    question: string;
    partner?: PartnerInput;
}) {
    const items = [
        profile ? `档案：${profile.name} / ${profile.zodiacSign}` : "档案：生成时自动保存",
        `方向：${intent.label}`,
        question
            ? `问题：${question.slice(0, 28)}${question.length > 28 ? "..." : ""}`
            : "问题：使用默认问题",
        partner ? `关系对象：${partner.name} / ${partner.relationshipStatus}` : "",
    ].filter(Boolean);
    return (
        <section className="generation-panel">
            <div className="panel-kicker">
                <FileText size={14} /> 本次参考
            </div>
            <h3>报告会看这些信息</h3>
            <p>提交后会按所选类型生成报告，结果会进入当前报告和报告库。</p>
            <ul>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
            <div className="generation-cost-row">
                <span>
                    <Coins size={15} /> {priceGroupLabel(intent.priceGroup)}
                </span>
                <span>
                    <ShieldCheck size={15} /> 失败自动退款
                </span>
            </div>
            {completion.missing.length > 0 && (
                <div className="missing-note">
                    可提升：补充 {completion.missing.join("、")} 后，报告会更具体。
                </div>
            )}
        </section>
    );
}

function ProfileReadiness({
    profile,
    completion,
    onOpenProfile,
}: {
    profile: AstrologyProfile | null;
    completion: ProfileCompletion;
    onOpenProfile: () => void;
}) {
    return (
        <section className="readiness-card">
            <div>
                <div className="panel-kicker">
                    <UserRound size={14} /> 档案准备度
                </div>
                <h3>{profile?.name || "未选择档案"}</h3>
                <p>
                    {profile
                        ? `${profile.zodiacSign} · ${profile.birthDate}`
                        : "先建立档案，再让报告拿到稳定上下文。"}
                </p>
            </div>
            <div className="progress-line">
                <span style={{ width: `${completion.percent}%` }} />
            </div>
            <div className="readiness-bottom">
                <span>{completion.percent}%</span>
                <Button
                    className="astro-secondary"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onOpenProfile}
                >
                    {completion.missing.length ? "去完善" : "查看档案"}
                </Button>
            </div>
        </section>
    );
}

function GenerationFooter({ intent, busy }: { intent: ReportIntent; busy: boolean }) {
    return (
        <div className="generation-footer">
            <CostHint intent={intent} />
            <Button className="astro-primary" disabled={busy} loading={busy} type="submit">
                <FileText size={16} />
                生成 {intent.label}
            </Button>
        </div>
    );
}

function CostHint({ intent, compact }: { intent: ReportIntent; compact?: boolean }) {
    return (
        <div className={`cost-hint ${compact ? "compact" : ""}`}>
            <span>
                <Coins size={14} /> {priceGroupLabel(intent.priceGroup)}
            </span>
            <span>
                <ShieldCheck size={14} /> 失败退款
            </span>
        </div>
    );
}

function IntentButton({
    intent,
    active,
    onClick,
}: {
    intent: ReportIntent;
    active: boolean;
    onClick: () => void;
}) {
    const Icon = intent.icon;
    return (
        <Button
            className={`intent-button ${active ? "active" : ""}`}
            variant="ghost"
            onClick={onClick}
            type="button"
        >
            <Icon size={16} />
            <span>{intent.label}</span>
            <small>{intent.subtitle}</small>
        </Button>
    );
}

function TextField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div className="field">
            <Label className="astro-label">{label}</Label>
            <Input
                className="astro-control"
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function Template({ children, onClick }: { children: string; onClick: () => void }) {
    return (
        <Button
            className="astro-secondary"
            variant="outline"
            size="sm"
            onClick={onClick}
            type="button"
        >
            <Wand2 size={13} />
            {children}
        </Button>
    );
}

function StatusBox({
    icon,
    title,
    text,
    danger,
    children,
}: {
    icon?: ReactNode;
    title: string;
    text: string;
    danger?: boolean;
    children?: ReactNode;
}) {
    return (
        <div className={`status-box ${danger ? "danger" : ""}`}>
            {icon}
            <div>
                <strong>{title}</strong>
                <p>{text}</p>
                {children && <div className="status-actions">{children}</div>}
            </div>
        </div>
    );
}

function EmptyState({ title, text }: { title: string; text: string }) {
    return (
        <div className="empty-state">
            <strong>{title}</strong>
            <p>{text}</p>
        </div>
    );
}

function Action({
    children,
    onClick,
    danger,
    disabled,
}: {
    children: ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
}) {
    return (
        <Button
            className={danger ? "astro-danger" : "astro-secondary"}
            variant={danger ? "destructive" : "outline"}
            size="sm"
            onClick={onClick}
            disabled={disabled}
            type="button"
        >
            {children}
        </Button>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="metric-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function Lucky({ label, value }: { label: string; value?: string }) {
    return (
        <div className="lucky-card">
            <span>{label}</span>
            <strong>{value || "--"}</strong>
        </div>
    );
}

function ActionList({ items, compact }: { items: string[]; compact?: boolean }) {
    if (!items.length) return null;
    return (
        <div className="action-list">
            <div className="list-title">下一步行动</div>
            {items.slice(0, compact ? 3 : 5).map((item, index) => (
                <label key={`${item}-${index}`} className="action-item">
                    <Checkbox className="mt-1" />
                    <span>{item}</span>
                </label>
            ))}
        </div>
    );
}

function FollowUpPanel({
    report,
    compact,
    onFollowUp,
}: {
    report: AstrologyReport;
    compact?: boolean;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
}) {
    const prompts = [
        "基于「{title}」，帮我拆成今天能执行的 3 个行动。",
        "基于「{title}」，哪些判断最不确定？我应该观察什么信号？",
        "基于「{title}」，把建议改成更直接的沟通话术。",
    ];
    return (
        <div className="followup-panel">
            <div>
                <div className="list-title">继续追问</div>
                {!compact && <p>会带着当前报告上下文回到问问区，再生成一份新的细化报告。</p>}
            </div>
            <div className="followup-actions">
                {prompts.slice(0, compact ? 2 : prompts.length).map((prompt) => (
                    <Button
                        key={prompt}
                        className="astro-secondary"
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onFollowUp(report, prompt)}
                    >
                        {prompt.replace("「{title}」", "这份报告")}
                    </Button>
                ))}
            </div>
        </div>
    );
}

const feedbackOptions: Array<{ value: UpdateReportFeedbackParams["rating"]; label: string }> = [
    { value: "useful", label: "有用" },
    { value: "too_generic", label: "太泛" },
    { value: "inaccurate", label: "不准" },
    { value: "too_long", label: "太长" },
];

function FeedbackPanel({
    report,
    compact,
    onFeedback,
}: {
    report: AstrologyReport;
    compact?: boolean;
    onFeedback: (report: AstrologyReport, rating: UpdateReportFeedbackParams["rating"]) => void;
}) {
    const selected = report.providerMetadata?.feedback?.rating;
    return (
        <div className="feedback-panel">
            <div>
                <div className="list-title">报告反馈</div>
                {!compact && <p>反馈会保存到报告记录，用于后续提示词和报告质量优化。</p>}
            </div>
            <div className="feedback-actions">
                {feedbackOptions.map((option) => (
                    <Button
                        key={option.value}
                        className={selected === option.value ? "active" : ""}
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onFeedback(report, option.value)}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}

function ReportDetailModal({
    report,
    onClose,
    onCopy,
    onFavorite,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
}: {
    report: AstrologyReport | null;
    onClose: () => void;
    onCopy: (report: AstrologyReport) => void;
    onFavorite: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: (report: AstrologyReport, rating: UpdateReportFeedbackParams["rating"]) => void;
}) {
    const result = report?.result;
    const deleteDisabled = report ? isReportBusy(report.status) : false;
    return (
        <Dialog
            open={!!report}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[88vh] overflow-auto sm:max-w-[920px]">
                <DialogHeader>
                    <DialogDescription>
                        {report ? (
                            <>
                                {reportLabel(report.reportType)} ·{" "}
                                <TimeText value={report.createdAt} format="YYYY/MM/DD HH:mm" /> ·
                                扣费 {formatCredits(report.costCredits)}
                            </>
                        ) : (
                            "报告详情"
                        )}
                    </DialogDescription>
                    <DialogTitle className="text-2xl font-bold">
                        {result?.title || "报告详情"}
                    </DialogTitle>
                </DialogHeader>
                {report?.errorMessage && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-4 text-sm">
                        {report.errorMessage}
                    </div>
                )}
                {report && result && (
                    <div className="space-y-5">
                        <p className="text-muted-foreground leading-7">{result.summary}</p>
                        <div className="metric-grid">
                            {Object.entries(result.scores ?? {}).map(([key, value]) => (
                                <Metric
                                    key={key}
                                    label={scoreLabel(key)}
                                    value={`${Math.round(value)}%`}
                                />
                            ))}
                        </div>
                        <div className="keyword-row">
                            {result.keywords?.map((item) => (
                                <span key={item}>{item}</span>
                            ))}
                        </div>
                        {result.sections?.map((section) => (
                            <article key={section.heading} className="report-section">
                                <h3>{section.heading}</h3>
                                <p>{section.content}</p>
                            </article>
                        ))}
                        <ListBlock title="行动建议" items={result.actions ?? []} />
                        <ListBlock title="风险提醒" items={result.warnings ?? []} />
                        <FollowUpPanel
                            report={report}
                            onFollowUp={(nextReport, prompt) => {
                                onClose();
                                onFollowUp(nextReport, prompt);
                            }}
                        />
                        <FeedbackPanel report={report} onFeedback={onFeedback} />
                        {result.closing && <div className="closing-card">{result.closing}</div>}
                    </div>
                )}
                {report && (
                    <div className="action-row pt-2">
                        <Action onClick={() => onCopy(report)}>
                            <Copy size={14} />
                            复制
                        </Action>
                        <Action onClick={() => onFavorite(report)}>
                            {report.isFavorite ? "取消收藏" : "收藏"}
                        </Action>
                        <Action onClick={() => onRegenerate(report)}>
                            <RefreshCw size={14} />
                            重新生成
                        </Action>
                        <Action
                            danger
                            disabled={deleteDisabled}
                            onClick={() => onDelete(report.id)}
                        >
                            <Trash2 size={14} />
                            {deleteDisabled ? "生成中不可删除" : "删除"}
                        </Action>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null;
    return (
        <div className="list-block">
            <h3>{title}</h3>
            <ul>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

type ProfileCompletion = { percent: number; missing: string[] };

function calculateProfileCompletion(profile: Partial<AstrologyProfileInput>): ProfileCompletion {
    const fields: Array<[keyof AstrologyProfileInput, string]> = [
        ["name", "姓名"],
        ["birthDate", "出生日期"],
        ["birthTime", "出生时间"],
        ["birthPlace", "出生地点"],
        ["zodiacSign", "太阳星座"],
        ["moonSign", "月亮星座"],
        ["risingSign", "上升星座"],
    ];
    const filled = fields.filter(([key]) => Boolean(profile[key]));
    const missing = fields.filter(([key]) => !profile[key]).map(([, label]) => label);
    return { percent: Math.round((filled.length / fields.length) * 100), missing };
}

function scoreLabel(key: string) {
    return (
        (
            {
                overall: "整体",
                love: "爱情",
                career: "事业",
                wealth: "财富",
                mood: "情绪",
                social: "人际",
            } as Record<string, string>
        )[key] || key
    );
}

function formatCredits(value?: number | string | null) {
    const numberValue = Number(value ?? 0);
    if (!Number.isFinite(numberValue)) return "0";
    return numberValue.toFixed(4).replace(/\.?0+$/, "");
}

function isReportBusy(status: AstrologyReport["status"]) {
    return status === "pending" || status === "processing";
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === "object" && error) {
        const directMessage =
            "message" in error && typeof error.message === "string" ? error.message : null;
        const response =
            "response" in error && typeof error.response === "object" && error.response
                ? error.response
                : null;
        const data =
            response && "data" in response && typeof response.data === "object" && response.data
                ? response.data
                : null;
        const responseMessage =
            data && "message" in data && typeof data.message === "string" ? data.message : null;
        return responseMessage || directMessage || fallback;
    }
    return fallback;
}

const styles = `
* { box-sizing: border-box; }
body { margin: 0; }
.astro-shell { --astro-surface: var(--card); --astro-border: var(--border); --astro-muted: var(--muted-foreground); --astro-soft: color-mix(in oklab, var(--muted-foreground) 72%, transparent); --astro-accent: var(--primary); --astro-accent-soft: color-mix(in oklab, var(--primary) 9%, transparent); --astro-danger: var(--destructive); min-height: 100vh; overflow-x: hidden; color: var(--foreground); background: color-mix(in oklab, var(--muted) 28%, var(--background)); font-family: Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: 0; }
.astro-page { width: min(1180px, 100%); margin: 0 auto; padding: 18px 18px 34px; }
.app-header { display: block; margin-bottom: 12px; }
.header-panel, .panel, .report-panel, .generation-panel, .readiness-card, .daily-panel { border: 1px solid var(--astro-border); background: var(--astro-surface); box-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent); }
.panel p, .daily-panel p, .generation-panel p, .readiness-card p { margin: 3px 0 0; color: var(--astro-muted); line-height: 1.6; }
.header-panel { cursor: pointer; border-radius: 10px; padding: 10px 12px; transition: border-color .16s ease, box-shadow .16s ease; }
.header-panel:hover { border-color: color-mix(in oklab, var(--astro-accent) 35%, var(--astro-border)); }
.profile-meta, .header-stats span { color: var(--astro-muted); font-size: 12px; }
.header-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.header-stats span { border: 1px solid var(--astro-border); border-radius: 999px; padding: 4px 8px; background: var(--muted); color: var(--muted-foreground); }
.data-status { display: flex; align-items: center; gap: 8px; margin: -2px 0 12px; border: 1px solid color-mix(in oklab, var(--astro-accent) 22%, var(--astro-border)); border-radius: 8px; background: var(--astro-accent-soft); padding: 9px 11px; color: var(--astro-accent); font-size: 12px; line-height: 1.45; }
.data-status svg { flex: 0 0 auto; }
.work-tabs { margin-bottom: 12px; }
.work-tabs-list { width: 100%; overflow-x: auto; justify-content: flex-start; }
.work-tab { min-width: 128px; height: auto; padding: 8px 10px; gap: 6px; }
.work-tab span { font-weight: 600; }
.work-tab small { display: block; color: var(--muted-foreground); font-size: 11px; font-weight: 400; line-height: 1.2; }
.work-grid, .today-layout, .profile-layout { display: grid; grid-template-columns: minmax(0,1.08fr) minmax(320px,.92fr); gap: 14px; align-items: start; }
.side-stack { display: grid; gap: 14px; }
.panel, .report-panel, .generation-panel, .readiness-card, .daily-panel { border-radius: 10px; padding: 16px; }
.daily-panel { display: grid; gap: 16px; }
.daily-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.daily-head h2 { margin: 6px 0 0; font-size: clamp(24px, 3vw, 34px); line-height: 1.12; font-weight: 700; }
.daily-head p { max-width: 640px; font-size: 14px; }
.panel-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.compact-heading { align-items: center; justify-content: space-between; }
.panel-heading h2, .report-head h2, .generation-panel h3, .readiness-card h3 { margin: 0; font-size: 20px; font-weight: 700; }
.panel-kicker { display: inline-flex; align-items: center; gap: 6px; color: var(--astro-accent); font-size: 12px; font-weight: 650; }
.panel-icon { display: grid; width: 38px; height: 38px; place-items: center; flex: 0 0 auto; border-radius: 9px; background: var(--astro-accent-soft); color: var(--astro-accent); }
.intent-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.intent-button { min-height: 74px; border: 1px solid var(--astro-border); border-radius: 9px; padding: 10px 11px; color: var(--astro-muted); background: var(--background); text-align: left; transition: border-color .16s ease, background-color .16s ease; }
.intent-button svg { color: var(--astro-accent); }
.intent-button span { display: block; margin-top: 6px; color: var(--foreground); font-weight: 650; }
.intent-button small { display: block; margin-top: 2px; color: var(--astro-muted); line-height: 1.35; }
.intent-button.active, .intent-button:hover { border-color: color-mix(in oklab, var(--astro-accent) 38%, var(--astro-border)); background: var(--astro-accent-soft); }
.context-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; border: 1px solid var(--astro-border); border-radius: 8px; padding: 9px 10px; color: var(--astro-muted); background: var(--muted); font-size: 13px; }
.context-strip strong { color: var(--foreground); }
.context-strip [data-slot="button"] { margin-left: auto; }
.form-section { margin-top: 15px; }
.two-cols { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.field { display: grid; gap: 7px; }
.astro-label { color: var(--foreground); font-weight: 600; }
.astro-control { min-height: 42px; }
.astro-select { width: 148px; }
.template-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.generation-footer, .primary-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; }
.cost-hint, .generation-cost-row { display: flex; flex-wrap: wrap; gap: 8px; color: var(--astro-muted); font-size: 12px; }
.cost-hint span, .generation-cost-row span { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--astro-border); border-radius: 999px; padding: 6px 9px; background: var(--muted); }
.astro-primary { font-weight: 600; }
.astro-secondary { }
.astro-danger { }
.generation-panel ul { margin: 12px 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.generation-panel li { border-left: 2px solid color-mix(in oklab, var(--astro-accent) 38%, var(--astro-border)); padding-left: 10px; color: var(--foreground); font-size: 13px; line-height: 1.55; }
.missing-note, .relation-note { display: flex; gap: 8px; margin-top: 12px; border-radius: 8px; background: var(--astro-accent-soft); padding: 10px; color: var(--astro-accent); font-size: 13px; line-height: 1.55; }
.readiness-card { display: grid; gap: 12px; }
.progress-line { height: 8px; overflow: hidden; border-radius: 999px; background: var(--muted); }
.progress-line span { display: block; height: 100%; border-radius: inherit; background: var(--astro-accent); }
.readiness-bottom { display: flex; justify-content: space-between; align-items: center; color: var(--astro-muted); }
.report-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.report-head p { margin: 4px 0 0; color: var(--astro-muted); font-size: 12px; }
.report-content { display: grid; gap: 14px; }
.report-summary { margin: 0; border-left: 3px solid color-mix(in oklab, var(--astro-accent) 42%, var(--astro-border)); padding-left: 12px; color: var(--foreground); line-height: 1.75; }
.keyword-row { display: flex; flex-wrap: wrap; gap: 7px; }
.keyword-row span { border: 1px solid color-mix(in oklab, var(--astro-accent) 20%, var(--astro-border)); border-radius: 999px; background: var(--astro-accent-soft); padding: 5px 9px; color: var(--astro-accent); font-size: 12px; }
.report-section, .list-block, .closing-card, .action-list, .followup-panel, .feedback-panel { border: 1px solid var(--astro-border); border-radius: 9px; background: var(--background); padding: 13px; }
.report-section h3, .list-block h3, .list-title { margin: 0; color: var(--foreground); font-size: 14px; font-weight: 650; }
.report-section p, .list-block li { color: var(--astro-muted); font-size: 14px; line-height: 1.7; }
.metric-grid, .lucky-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 9px; }
.lucky-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
.metric-card, .lucky-card { border: 1px solid var(--astro-border); border-radius: 8px; background: var(--muted); padding: 12px; }
.metric-card span, .lucky-card span { display: block; color: var(--astro-muted); font-size: 12px; }
.metric-card strong, .lucky-card strong { display: block; margin-top: 4px; font-size: 21px; }
.lucky-card strong { font-size: 15px; }
.action-row { display: flex; flex-wrap: wrap; gap: 8px; }
.action-list { display: grid; gap: 8px; }
.action-item { display: flex; align-items: flex-start; gap: 8px; color: var(--astro-muted); font-size: 13px; line-height: 1.55; }
.action-item input { margin-top: 3px; accent-color: var(--astro-accent); }
.followup-panel { display: grid; gap: 10px; }
.followup-panel p { margin: 3px 0 0; color: var(--astro-muted); font-size: 12px; }
.followup-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.followup-actions [data-slot="button"] { height: auto; min-height: 32px; white-space: normal; text-align: left; }
.feedback-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.feedback-panel p { margin: 3px 0 0; color: var(--astro-muted); font-size: 12px; }
.feedback-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.feedback-actions [data-slot="button"].active { border-color: color-mix(in oklab, var(--astro-accent) 34%, var(--astro-border)); background: var(--astro-accent-soft); color: var(--astro-accent); }
.status-box, .empty-state { display: flex; gap: 12px; align-items: flex-start; min-height: 150px; border: 1px dashed var(--astro-border); border-radius: 9px; background: var(--muted); padding: 18px; color: var(--astro-muted); }
.empty-state { display: grid; align-content: center; }
.status-box strong, .empty-state strong { color: var(--foreground); }
.status-box p, .empty-state p { margin: 6px 0 0; line-height: 1.65; }
.status-box.danger { border-color: color-mix(in oklab, var(--astro-danger) 30%, var(--astro-border)); background: color-mix(in oklab, var(--astro-danger) 10%, var(--background)); }
.status-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.profile-list, .history-list { display: grid; gap: 10px; }
.profile-card, .history-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; border: 1px solid var(--astro-border); border-radius: 9px; padding: 13px; color: var(--foreground); background: var(--background); text-align: left; transition: border-color .16s ease, background-color .16s ease; }
.profile-card:hover, .profile-card.active, .history-card:hover { border-color: color-mix(in oklab, var(--astro-accent) 35%, var(--astro-border)); background: var(--astro-accent-soft); }
.profile-card strong, .history-card strong { display: block; }
.profile-card span, .history-card span, .profile-card small { display: block; margin-top: 4px; color: var(--astro-muted); font-size: 12px; }
.mini-actions { display: flex; gap: 5px; flex-shrink: 0; }
.mini-actions span { border: 1px solid var(--astro-border); border-radius: 8px; background: var(--muted); padding: 5px 8px; color: var(--astro-muted); }
.mini-actions .danger { color: var(--astro-danger); }
.form-submit { margin-top: 14px; }
.history-score { text-align: right; flex-shrink: 0; }
.history-score b { display: block; font-size: 23px; }
.history-score small { color: var(--astro-accent); }
.pagination-row { display: flex; justify-content: flex-end; margin-top: 14px; }
.list-block ul { margin: 10px 0 0; padding-left: 18px; }
.closing-card { color: var(--astro-muted); line-height: 1.7; }
.header-panel { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 10px; border-radius: 8px; }
.profile-main { display: flex; min-width: 0; align-items: center; gap: 8px; }
.profile-main svg { color: var(--astro-accent); flex: 0 0 auto; }
.profile-main strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 650; }
.profile-main span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--astro-muted); font-size: 12px; }
.header-stats { justify-content: flex-end; margin-top: 0; }
.header-stats b { border: 1px solid var(--astro-border); border-radius: 999px; padding: 4px 8px; background: var(--astro-accent-soft); color: var(--astro-accent); font-size: 12px; }
.panel, .report-panel, .generation-panel, .readiness-card, .daily-panel { border-radius: 8px; }
.daily-head h2 { font-size: clamp(22px, 2.6vw, 30px); }
.context-row { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; border: 1px solid var(--astro-border); border-radius: 8px; background: var(--muted); padding: 9px 10px; font-size: 12px; color: var(--astro-muted); }
.context-row strong { color: var(--foreground); font-weight: 650; }
.intent-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.intent-strip::-webkit-scrollbar, .work-tabs-list::-webkit-scrollbar { display: none; }
.intent-button { min-width: 118px; min-height: auto; border-radius: 8px; padding: 9px 10px; }
.intent-button small { max-width: 140px; font-size: 11px; }
.ai-cue { display: flex; align-items: flex-start; gap: 7px; border-radius: 8px; background: var(--astro-accent-soft); padding: 9px 10px; color: var(--astro-accent); font-size: 12px; line-height: 1.45; }
.ai-cue svg { margin-top: 1px; flex: 0 0 auto; }
.relationship-summary { display: grid; gap: 3px; margin-top: 12px; border: 1px solid var(--astro-border); border-radius: 8px; background: var(--background); padding: 11px; }
.relationship-summary strong { font-size: 15px; }
.relationship-summary span { color: var(--astro-muted); font-size: 12px; }
.form-group-title { margin: 14px 0 8px; color: var(--astro-muted); font-size: 12px; font-weight: 650; }
.compact-fields { grid-template-columns: repeat(3, minmax(0,1fr)); }
.cost-hint.compact { justify-content: flex-end; flex-shrink: 0; }
.work-grid, .today-layout, .profile-layout, .report-content { animation: astroFade .18s ease-out; }
@keyframes astroFade { from { opacity: .65; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 900px) {
    .work-grid, .today-layout, .profile-layout { grid-template-columns: 1fr; }
    .work-tab small { display: none; }
    .daily-head { display: grid; }
}
@media (max-width: 760px) {
    .astro-page { padding: 12px; }
    .app-header { margin-bottom: 10px; }
    .header-panel { min-height: 50px; align-items: flex-start; flex-direction: column; gap: 7px; padding: 10px 12px; }
    .profile-main { width: 100%; }
    .header-stats { justify-content: flex-start; }
    .header-stats span:nth-child(2), .header-stats span:nth-child(3) { display: none; }
    .work-tabs-list { padding-bottom: 2px; }
    .work-tab { min-width: 64px; padding: 8px 6px; gap: 4px; }
    .work-tab small { display: none; }
    .panel, .report-panel, .generation-panel, .readiness-card, .daily-panel { border-radius: 9px; padding: 14px; }
    .daily-panel { gap: 13px; }
    .daily-head h2 { font-size: 24px; line-height: 1.14; }
    .daily-head p { font-size: 13px; line-height: 1.5; }
    .cost-hint.compact { justify-content: flex-start; }
    .intent-grid, .two-cols, .metric-grid, .lucky-grid { grid-template-columns: 1fr; }
    .compact-fields { grid-template-columns: 1fr; }
    .intent-button { min-width: 108px; }
    .intent-button small { display: none; }
    .generation-footer, .primary-actions, .report-head, .compact-heading { align-items: stretch; flex-direction: column; }
    .primary-actions { flex-direction: row; }
    .primary-actions .astro-primary, .primary-actions .astro-secondary { flex: 1 1 0; padding-left: 8px; padding-right: 8px; }
    .feedback-panel { align-items: flex-start; flex-direction: column; }
    .feedback-actions { justify-content: flex-start; }
    .context-strip [data-slot="button"] { margin-left: 0; }
    .profile-card, .history-card { align-items: flex-start; }
    .history-score { text-align: left; }
}
`;
