import { useCopy } from "@buildingai/hooks";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
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
import { Progress } from "@buildingai/ui/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import { cn } from "@buildingai/ui/lib/utils";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Coins,
    Copy,
    Download,
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
import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { buildAstrologyQuestionQualityContext } from "../../shared/astrology-question-quality";
import {
    priceGroupLabel,
    reportIntents,
    reportLabel,
    statusLabel,
    type ReportIntent,
} from "../constants/report-types";
import { formatCredits, formatDateTime } from "../utils/format";
import {
    useAstrologyGenerationStatusQuery,
    useAstrologyProfilesQuery,
    useAstrologyReportDetailQuery,
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

type GenerationBlock = {
    title: string;
    text: string;
    actionLabel?: string;
    tone?: "neutral" | "warning";
};

type ReportFeedbackHandler = (
    report: AstrologyReport,
    rating: UpdateReportFeedbackParams["rating"],
    note?: UpdateReportFeedbackParams["note"],
) => void;
type ReportActionItem = NonNullable<AstrologyReport["result"]>["actions"][number];
type ReportWarningItem = NonNullable<AstrologyReport["result"]>["warnings"][number];

type DailyFocusOption = {
    label: string;
    focusArea: string;
    state: string;
    question: string;
};

const defaultIntent = reportIntents[0] as ReportIntent;
const dailyIntent = reportIntents.find((item) => item.value === "daily") ?? defaultIntent;
const relationshipIntent =
    reportIntents.find((item) => item.value === "compatibility") ?? defaultIntent;

const dailyFocusOptions: DailyFocusOption[] = [
    {
        label: "综合",
        focusArea: "今日综合运势",
        state: "想知道今天适合推进什么",
        question: "今天我最应该把注意力放在哪里？",
    },
    {
        label: "事业",
        focusArea: "今日事业节奏",
        state: "今天有工作推进、沟通或选择需要处理",
        question: "今天我在工作上应该先推进什么、暂时避开什么？",
    },
    {
        label: "感情",
        focusArea: "今日感情互动",
        state: "想看今天适合怎样表达、靠近或保持距离",
        question: "今天我在感情互动里适合主动一点，还是先观察？",
    },
    {
        label: "财富",
        focusArea: "今日财富与资源",
        state: "想判断今天适不适合花钱、谈资源或做财务决定",
        question: "今天我在钱、资源和机会上需要注意什么？",
    },
    {
        label: "情绪",
        focusArea: "今日情绪能量",
        state: "想知道今天如何稳定状态、避免内耗",
        question: "今天我最容易被什么影响情绪，应该怎样调整？",
    },
];

const relationshipScenes = ["暧昧", "恋爱", "复合", "婚姻", "合作"];

const intentQuestionTemplates: Partial<Record<AstrologyReportType, string[]>> = {
    daily: [
        "今天最值得优先推进的一件事是什么？",
        "今天我需要避开什么误判或沟通方式？",
        "今天有哪些信号说明方向是对的？",
    ],
    love: [
        "我和对方现在最需要处理的关系卡点是什么？",
        "近期适合主动沟通，还是先观察对方反应？",
        "我在感情里反复出现的模式是什么？",
    ],
    career: [
        "这周我在工作上最该争取什么机会？",
        "当前工作机会适合继续投入吗？",
        "我应该如何调整事业节奏和优先级？",
    ],
    wealth: [
        "近期我在花钱和资源配置上要注意什么？",
        "现在适合推进某个赚钱计划吗？",
        "哪些风险会影响我的财务判断？",
    ],
    compatibility: [
        "我们之间的吸引力和冲突点分别是什么？",
        "这段关系适合继续推进到下一步吗？",
        "我应该用什么方式和对方沟通更有效？",
    ],
    decision: [
        "要不要继续推进这段关系？",
        "这份工作机会现在适合我吗？",
        "未来一周我应该先处理什么？",
    ],
    personality: [
        "我的核心性格优势和盲点是什么？",
        "我适合怎样的工作和关系节奏？",
        "哪些情绪模式最容易影响我的选择？",
    ],
};

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
    name: "",
    birthDate: "",
    birthTime: "",
    birthPlace: "",
    gender: "",
    moonSign: "",
    risingSign: "",
};

const defaultPartner: PartnerInput = {
    name: "",
    birthDate: "",
    birthTime: "",
    birthPlace: "",
    zodiacSign: "",
    relationshipStatus: "",
};

const HISTORY_PAGE_SIZE = 12;

export default function AstrologyFortuneHomePage() {
    const { copy } = useCopy();
    const [activeView, setActiveView] = useState<WorkView>("today");
    const [profileForm, setProfileForm] = useState<AstrologyProfileInput>(defaultProfile);
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [reportType, setReportType] = useState<AstrologyReportType>("daily");
    const [dailyFocus, setDailyFocus] = useState(dailyFocusOptions[0]);
    const [focusArea, setFocusArea] = useState(defaultIntent.focusArea);
    const [currentState, setCurrentState] = useState(defaultIntent.currentState);
    const [question, setQuestion] = useState(defaultIntent.question);
    const [partner, setPartner] = useState<PartnerInput>(defaultPartner);
    const [activeReport, setActiveReport] = useState<AstrologyReport | null>(null);
    const [detailReport, setDetailReport] = useState<AstrologyReport | null>(null);
    const [pendingReportId, setPendingReportId] = useState<string | null>(null);
    const [followUpSourceReportId, setFollowUpSourceReportId] = useState<string | null>(null);
    const [historyType, setHistoryType] = useState<AstrologyReportType | "all" | "favorite">("all");
    const [historyPage, setHistoryPage] = useState(1);

    const profilesQuery = useAstrologyProfilesQuery();
    const generationStatus = useAstrologyGenerationStatusQuery();
    const pendingReportQuery = useAstrologyReportDetailQuery(pendingReportId ?? undefined);
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
    const followUpSourceReport = reports.find((item) => item.id === followUpSourceReportId) ?? null;
    const currentReport = activeReport ?? latestSuccessfulReport ?? null;
    const currentIntent = reportIntents.find((item) => item.value === reportType) ?? defaultIntent;
    const busy =
        createProfileMutation.isPending ||
        updateProfileMutation.isPending ||
        generateReportMutation.isPending;
    const profileCompletion = useMemo(
        () => calculateProfileCompletion(selectedProfile ?? profileForm),
        [selectedProfile, profileForm],
    );
    const toolbarIntent =
        activeView === "relationship"
            ? relationshipIntent
            : activeView === "today"
              ? dailyIntent
              : currentIntent;
    const dataUnavailable = profilesQuery.isError || reportsQuery.isError;
    const generationDisabled = generationStatus.data?.canGenerate === false;
    const generationUnavailableReason =
        generationStatus.data?.unavailableReason || "当前生成服务暂不可用，请稍后再试。";
    const generationBlock = getGenerationBlock({
        profile: selectedProfile,
        profileInput: selectedProfile ?? profileForm,
        generationDisabled,
        generationUnavailableReason,
    });
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

    useEffect(() => {
        const pendingReport = pendingReportQuery.data;
        if (!pendingReport) return;
        setActiveReport(pendingReport);
        setDetailReport(pendingReport);
        if (pendingReport.status === "success" || pendingReport.status === "failed") {
            setPendingReportId(null);
            reportsQuery.refetch();
            if (pendingReport.status === "success") {
                toast.success("报告生成完成！");
            } else {
                toast.error(pendingReport.errorMessage || "报告生成失败");
            }
        }
    }, [pendingReportQuery.data?.id, pendingReportQuery.data?.updatedAt]);

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
        if (generationDisabled) {
            toast.error(generationUnavailableReason);
            return;
        }
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
            setPendingReportId(report.id);
            setFollowUpSourceReportId(null);
            toast.success("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            toast.error(getErrorMessage(error, "报告生成失败"));
            reportsQuery.refetch();
        }
    }

    async function handleRegenerate(report: AstrologyReport) {
        if (generationDisabled) {
            toast.error(generationUnavailableReason);
            return;
        }
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
            setPendingReportId(regenerated.id);
            toast.success("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            toast.error(getErrorMessage(error, "重新生成失败"));
            reportsQuery.refetch();
        }
    }

    async function handleDeleteReport(reportId: string) {
        try {
            await deleteReportMutation.mutateAsync(reportId);
            if (activeReport?.id === reportId) setActiveReport(null);
            if (detailReport?.id === reportId) setDetailReport(null);
            if (pendingReportId === reportId) setPendingReportId(null);
            toast.success("报告已删除");
        } catch (error) {
            toast.error(getErrorMessage(error, "报告删除失败"));
        }
    }

    async function copyReport(report: AstrologyReport) {
        await copy(getReportExportText(report));
        toast.success("报告内容已复制");
    }

    function downloadReport(report: AstrologyReport) {
        const text = getReportExportText(report);
        if (!text) {
            toast.error("暂无可下载的报告内容");
            return;
        }
        const filename = `${(report.result?.title || reportLabel(report.reportType)).replace(/[\\/:*?"<>|]/g, "-")}.txt`;
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("报告文本已下载");
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
        note?: UpdateReportFeedbackParams["note"],
    ) {
        try {
            const updatedReport = await feedbackMutation.mutateAsync({
                reportId: report.id,
                params: { rating, note },
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
        <main className="astro-workbench w-full overflow-x-hidden px-3 pb-6 text-foreground sm:px-4">
            <section className="mx-auto w-full max-w-[1480px] space-y-3">
                <PluginBusinessToolbar
                    activeView={activeView}
                    intent={toolbarIntent}
                    profile={selectedProfile}
                    report={currentReport}
                    completion={profileCompletion}
                    generationBlock={generationBlock}
                    onChangeView={setActiveView}
                    onOpenProfiles={() => setActiveView("profiles")}
                />

                {dataUnavailable && <DataStatusNotice />}

                {activeView === "today" && (
                    <TodayView
                        profile={selectedProfile}
                        completion={profileCompletion}
                        dailyFocus={dailyFocus}
                        currentState={currentState}
                        question={question}
                        report={
                            activeReport?.reportType === "daily"
                                ? activeReport
                                : (latestDailyReport ?? currentReport)
                        }
                        busy={busy}
                        generationBlock={generationBlock}
                        generationDisabled={generationDisabled}
                        generationUnavailableReason={generationUnavailableReason}
                        onDailyFocusChange={(option) => {
                            setDailyFocus(option);
                            setFocusArea(option.focusArea);
                            setCurrentState(option.state);
                            setQuestion(option.question);
                        }}
                        onCurrentStateChange={setCurrentState}
                        onQuestionChange={setQuestion}
                        onGenerate={() =>
                            handleGenerateReport(undefined, {
                                intent: dailyIntent,
                                focusArea: dailyFocus.focusArea,
                                currentState: currentState || dailyFocus.state,
                                question: question || dailyFocus.question,
                            })
                        }
                        onOpenProfile={() => setActiveView("profiles")}
                        onOpenReport={setDetailReport}
                        onFavorite={handleFavorite}
                        onCopy={copyReport}
                        onDownload={downloadReport}
                        onDelete={handleDeleteReport}
                        onRegenerate={handleRegenerate}
                        onFollowUp={prepareFollowUp}
                        onFeedback={handleFeedback}
                    />
                )}

                {activeView === "ask" && (
                    <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
                        <ReportPanel
                            report={currentReport}
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
                            onFavorite={handleFavorite}
                            onCopy={copyReport}
                            onDownload={downloadReport}
                            onOpen={setDetailReport}
                            onDelete={handleDeleteReport}
                            onRegenerate={handleRegenerate}
                            onFollowUp={prepareFollowUp}
                            onFeedback={handleFeedback}
                        />
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
                            followUpSourceReport={followUpSourceReport}
                            busy={busy}
                            onFocusAreaChange={setFocusArea}
                            onCurrentStateChange={setCurrentState}
                            onQuestionChange={setQuestion}
                            onPartnerChange={setPartner}
                            onIntentChange={selectIntent}
                            onClearFollowUpSource={() => setFollowUpSourceReportId(null)}
                            onSubmit={(event) => handleGenerateReport(event)}
                            onOpenProfiles={() => setActiveView("profiles")}
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
                        />
                    </section>
                )}

                {activeView === "relationship" && (
                    <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
                        <ReportPanel
                            report={
                                activeReport?.reportType === "compatibility"
                                    ? activeReport
                                    : (latestCompatibilityReport ?? currentReport)
                            }
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
                            onFavorite={handleFavorite}
                            onCopy={copyReport}
                            onDownload={downloadReport}
                            onOpen={setDetailReport}
                            onDelete={handleDeleteReport}
                            onRegenerate={handleRegenerate}
                            onFollowUp={prepareFollowUp}
                            onFeedback={handleFeedback}
                        />
                        <RelationshipPanel
                            partner={partner}
                            profile={selectedProfile}
                            busy={busy}
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
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
                    <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.96fr)]">
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
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
                            onFavorite={handleFavorite}
                            onCopy={copyReport}
                            onDownload={downloadReport}
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
                onDownload={downloadReport}
                onFavorite={handleFavorite}
                onDelete={handleDeleteReport}
                onRegenerate={handleRegenerate}
                onFollowUp={prepareFollowUp}
                onFeedback={handleFeedback}
                generationDisabled={generationDisabled}
                generationUnavailableReason={generationUnavailableReason}
            />
        </main>
    );
}

function DataStatusNotice() {
    return (
        <div className="mb-3 flex items-center gap-2 rounded-md border bg-muted p-3 text-xs text-muted-foreground">
            <AlertCircle size={15} />
            <span>本地数据暂不可用，页面已切换为空状态。生成和保存需要主服务连接正常。</span>
        </div>
    );
}

function PluginBusinessToolbar({
    activeView,
    intent,
    profile,
    completion,
    onChangeView,
    onOpenProfiles,
}: {
    activeView: WorkView;
    intent: ReportIntent;
    profile: AstrologyProfile | null;
    report: AstrologyReport | null;
    completion: ProfileCompletion;
    generationBlock: GenerationBlock | null;
    onChangeView: (view: WorkView) => void;
    onOpenProfiles: () => void;
}) {
    return (
        <header className="astro-toolbar sticky top-0 z-10 mb-3 grid gap-2 border bg-background/95 p-1.5 backdrop-blur lg:grid-cols-[minmax(220px,.62fr)_minmax(0,1.38fr)]">
            <div
                className="astro-toolbar-profile min-w-0 cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                role="button"
                tabIndex={0}
                onClick={onOpenProfiles}
                onKeyDown={(event) => {
                    if (event.key === "Enter") onOpenProfiles();
                }}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <UserRound size={16} />
                    <strong>{activeView === "today" ? "今日建议" : itemLabel(activeView)}</strong>
                    <span className="truncate text-muted-foreground">{profile ? `${profile.name} · ${profile.zodiacSign || "星座待补"}` : "档案未完善"}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <span>{profile ? intent.label : "选择档案后生成报告"}</span>
                    <span>素材 {completion.percent}%</span>
                </div>
            </div>
            <WorkTabs activeView={activeView} onChange={onChangeView} />
        </header>
    );
}

function itemLabel(view: WorkView) {
    return viewOptions.find((item) => item.value === view)?.label ?? "今日";
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
            className="min-w-0"
        >
            <TabsList className="astro-work-tabs grid w-full grid-cols-5 justify-start border-b bg-transparent max-[760px]:overflow-visible min-[761px]:flex min-[761px]:overflow-x-auto [&::-webkit-scrollbar]:hidden" variant="line">
                {viewOptions.map((item) => {
                    const Icon = item.icon;
                    return (
                        <TabsTrigger key={item.value} value={item.value} className="h-10 min-w-0 gap-1.5 whitespace-nowrap rounded-none px-2 text-muted-foreground data-[state=active]:text-foreground max-[760px]:[&_svg]:hidden">
                            <Icon size={17} />
                            <span>{item.label}</span>
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
    dailyFocus,
    currentState,
    question,
    report,
    busy,
    generationBlock,
    generationDisabled,
    generationUnavailableReason,
    onDailyFocusChange,
    onCurrentStateChange,
    onQuestionChange,
    onGenerate,
    onOpenProfile,
    onOpenReport,
    onFavorite,
    onCopy,
    onDownload,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
}: {
    profile: AstrologyProfile | null;
    completion: ProfileCompletion;
    dailyFocus: DailyFocusOption;
    currentState: string;
    question: string;
    report: AstrologyReport | null;
    busy: boolean;
    generationBlock: GenerationBlock | null;
    generationDisabled: boolean;
    generationUnavailableReason: string;
    onDailyFocusChange: (option: DailyFocusOption) => void;
    onCurrentStateChange: (value: string) => void;
    onQuestionChange: (value: string) => void;
    onGenerate: () => void;
    onOpenProfile: () => void;
    onOpenReport: (report: AstrologyReport) => void;
    onFavorite: (report: AstrologyReport) => void;
    onCopy: (report: AstrologyReport) => void;
    onDownload: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: ReportFeedbackHandler;
}) {
    return (
        <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
            <ReportPanel
                report={report}
                generationDisabled={generationDisabled}
                generationUnavailableReason={generationUnavailableReason}
                onFavorite={onFavorite}
                onCopy={onCopy}
                onDownload={onDownload}
                onOpen={onOpenReport}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onFollowUp={onFollowUp}
                onFeedback={onFeedback}
            />

            <div className="grid gap-3">
                <div className="astro-hero-card rounded-md border bg-card p-4">
                <div className="mb-4 border-b pb-4">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <CalendarDays size={15} /> 今日建议
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">{generationBlock?.title || "今天想关注什么？"}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{generationBlock?.text || "结合星盘档案、今日状态和关注点，生成一份能执行的今日建议。"}</p>
                    {generationBlock && generationBlock.tone !== "warning" && (
                        <Button className="mt-3 font-semibold" variant="outline" onClick={onOpenProfile} type="button">
                            <UserRound size={16} />
                            {generationBlock.actionLabel || "去完善档案"}
                        </Button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="今日关注点">
                    {dailyFocusOptions.map((option) => (
                        <Button
                            key={option.label}
                            className={cn(dailyFocus.label === option.label && "border-primary/30 bg-primary/5 text-foreground")}
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => onDailyFocusChange(option)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TextField
                        label="今天状态"
                        value={currentState}
                        onChange={onCurrentStateChange}
                    />
                    <TextField label="想确认的问题" value={question} onChange={onQuestionChange} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {intentQuestionTemplates.daily?.map((item) => (
                        <Template key={item} onClick={() => onQuestionChange(item)}>
                            {item}
                        </Template>
                    ))}
                </div>
                {generationBlock && <GenerationUnavailableNotice block={generationBlock} />}
                <div className="mt-4 flex items-center justify-between gap-3 max-md:grid">
                    <CostHint intent={dailyIntent} />
                    <Button
                        className="font-semibold"
                        loading={busy}
                        disabled={busy || Boolean(generationBlock)}
                        onClick={onGenerate}
                        type="button"
                    >
                        <CalendarDays size={16} />
                        {generationBlock?.actionLabel || "生成今日建议"}
                    </Button>
                </div>
            </div>
            <ProfileReadiness
                profile={profile}
                completion={completion}
                onOpenProfile={onOpenProfile}
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
    followUpSourceReport: AstrologyReport | null;
    busy: boolean;
    generationDisabled: boolean;
    generationUnavailableReason: string;
    onFocusAreaChange: (value: string) => void;
    onCurrentStateChange: (value: string) => void;
    onQuestionChange: (value: string) => void;
    onPartnerChange: (value: PartnerInput) => void;
    onIntentChange: (intent: ReportIntent) => void;
    onClearFollowUpSource: () => void;
    onSubmit: (event: FormEvent) => void;
    onOpenProfiles: () => void;
}) {
    const Icon = props.intent.icon;
    const templates =
        intentQuestionTemplates[props.reportType] ??
        intentQuestionTemplates.decision ??
        [];
    const { generationDisabled, generationUnavailableReason } = props;
    const quality = getQuestionQuality({
        reportType: props.reportType,
        focusArea: props.focusArea,
        currentState: props.currentState,
        question: props.question,
    });
    return (
        <form className="self-start rounded-md border bg-card p-4" onSubmit={props.onSubmit}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon size={18} />
                </div>
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">定向解读</div>
                    <h2>问一个具体问题</h2>
                    <p>把场景、时间和目标说清楚，AI 会优先给出可验证的判断和行动建议。</p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                {props.intents.map((intent) => (
                    <IntentButton
                        key={intent.value}
                        intent={intent}
                        active={props.reportType === intent.value}
                        disabled={generationDisabled}
                        onClick={() => props.onIntentChange(intent)}
                    />
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted p-3 text-xs text-muted-foreground">
                <span>当前档案</span>
                <strong>{props.selectedProfile?.name || "生成时自动创建"}</strong>
                <Button
                    className="font-semibold text-muted-foreground"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={props.onOpenProfiles}
                >
                    档案完整度 {props.profileCompletion.percent}%
                </Button>
            </div>

            {props.followUpSourceReport && (
                <div className="mt-3 grid gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-foreground">基于上一份报告继续</strong>
                        <Button
                            className="font-semibold text-muted-foreground"
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={props.onClearFollowUpSource}
                        >
                            清除上下文
                        </Button>
                    </div>
                    <p>
                        AI 会带着这份报告的摘要、行动项、风险提醒和复盘清单继续分析。
                    </p>
                    <span>
                        来源：
                        {props.followUpSourceReport.result?.title ||
                            props.followUpSourceReport.question ||
                            reportLabel(props.followUpSourceReport.reportType)}
                    </span>
                </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TextField
                    label="关注方向"
                    value={props.focusArea}
                    onChange={props.onFocusAreaChange}
                    disabled={generationDisabled}
                />
                <TextField
                    label="当前状态"
                    value={props.currentState}
                    onChange={props.onCurrentStateChange}
                    disabled={generationDisabled}
                />
            </div>

            {props.reportType === "compatibility" && (
                <PartnerFields partner={props.partner} onChange={props.onPartnerChange} disabled={generationDisabled} />
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
                {templates.map((item) => (
                    <Template key={item} onClick={() => props.onQuestionChange(item)} disabled={generationDisabled}>
                        {item}
                    </Template>
                ))}
            </div>

            <div className="mt-4">
                <Label className="font-semibold text-foreground">具体问题</Label>
                <Textarea
                    className="min-h-28"
                    value={props.question}
                    disabled={generationDisabled}
                    onChange={(event) => props.onQuestionChange(event.target.value)}
                />
            </div>

            {generationDisabled && <GenerationUnavailableNotice text={`当前生成服务暂不可用：${generationUnavailableReason}`} />}

            <QuestionQualityPanel quality={quality} />

            <GenerationFooter intent={props.intent} busy={props.busy} generationDisabled={generationDisabled} />
        </form>
    );
}

function RelationshipPanel({
    partner,
    profile,
    busy,
    generationDisabled,
    generationUnavailableReason,
    onPartnerChange,
    onGenerate,
    onOpenProfiles,
}: {
    partner: PartnerInput;
    profile: AstrologyProfile | null;
    busy: boolean;
    generationDisabled: boolean;
    generationUnavailableReason: string;
    onPartnerChange: (partner: PartnerInput) => void;
    onGenerate: () => void;
    onOpenProfiles: () => void;
}) {
    const partnerCompletion = calculatePartnerCompletion(partner);
    return (
        <section className="rounded-md border bg-card p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Heart size={18} />
                </div>
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">关系解读</div>
                    <h2>对象、状态和问题</h2>
                    <p>补充关系场景和对方信息，AI 会聚焦吸引力、冲突点、沟通话术和下一步。</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted p-3 text-xs text-muted-foreground">
                <span>我的档案</span>
                <strong>{profile?.name || "未选择档案"}</strong>
                <Button
                    className="font-semibold text-muted-foreground"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onOpenProfiles}
                >
                    切换或完善
                </Button>
            </div>
            <div className="grid gap-3 rounded-md border bg-muted p-3 sm:grid-cols-3">
                <strong>{partner.name || "TA"}</strong>
                <span>{partner.relationshipStatus || "关系状态待补充"}</span>
                <span>
                    {partner.birthDate
                        ? `${partner.birthDate}${partner.zodiacSign ? ` · ${partner.zodiacSign}` : ""}`
                        : "生日可选，但补充后更准"}
                </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="关系场景">
                {relationshipScenes.map((scene) => (
                    <Button
                        key={scene}
                        className={cn(partner.relationshipStatus === scene && "border-primary/30 bg-primary/5 text-foreground")}
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={generationDisabled}
                        onClick={() => onPartnerChange({ ...partner, relationshipStatus: scene })}
                    >
                        {scene}
                    </Button>
                ))}
            </div>
            <PartnerFields partner={partner} onChange={onPartnerChange} disabled={generationDisabled} />
            <CompletionMeter
                title="关系信息可信度"
                completion={partnerCompletion}
                text="对方资料越完整，关系节奏、冲突来源和相处建议越能落到细节。"
            />
            {generationDisabled && <GenerationUnavailableNotice text={generationUnavailableReason} />}
            <div className="mt-4 flex items-center justify-between gap-3">
                <CostHint intent={relationshipIntent} />
                <Button
                    className="font-semibold"
                    loading={busy}
                    disabled={busy || generationDisabled}
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
    disabled,
}: {
    partner: PartnerInput;
    onChange: (partner: PartnerInput) => void;
    disabled?: boolean;
}) {
    return (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField
                label="对方称呼"
                value={partner.name}
                onChange={(value) => onChange({ ...partner, name: value })}
                disabled={disabled}
            />
            <TextField
                label="出生日期"
                value={partner.birthDate}
                type="date"
                onChange={(value) => onChange({ ...partner, birthDate: value })}
                disabled={disabled}
            />
            <TextField
                label="出生时间"
                value={partner.birthTime}
                type="time"
                onChange={(value) => onChange({ ...partner, birthTime: value })}
                disabled={disabled}
            />
            <TextField
                label="出生地点"
                value={partner.birthPlace}
                onChange={(value) => onChange({ ...partner, birthPlace: value })}
                disabled={disabled}
                placeholder="可选"
            />
            <TextField
                label="星座"
                value={partner.zodiacSign}
                onChange={(value) => onChange({ ...partner, zodiacSign: value })}
                disabled={disabled}
                placeholder="留空自动推算"
            />
            <TextField
                label="关系状态"
                value={partner.relationshipStatus}
                onChange={(value) => onChange({ ...partner, relationshipStatus: value })}
                disabled={disabled}
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
        <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.04fr)_minmax(300px,.96fr)]">
            <div className="rounded-md border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">星盘档案</div>
                        <h2>选择生成依据</h2>
                        <p>档案是报告的长期记忆，不需要每次重新填写。</p>
                    </div>
                    <Button
                        className="font-semibold text-muted-foreground"
                        variant="outline"
                        onClick={props.onReset}
                        type="button"
                    >
                        <Plus size={16} /> 新档案
                    </Button>
                </div>
                <div className="grid gap-2">
                    {props.profiles.map((profile) => {
                        const completion = calculateProfileCompletion(profile);
                        return (
                            <Button
                                key={profile.id}
                                className={cn("flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3 text-left hover:border-primary/30 hover:bg-primary/5", props.selectedProfileId === profile.id && "border-primary/30 bg-primary/5")}
                                variant="ghost"
                                onClick={() => props.onSelect(profile.id)}
                                type="button"
                            >
                                <div>
                                    <strong>{profile.name}</strong>
                                    <span>
                                        {profile.zodiacSign || "待推算"} · 生肖
                                        {profile.chineseZodiac || "待补充"}
                                    </span>
                                    <small>
                                        {profile.birthDate} {profile.birthPlace || ""}
                                    </small>
                                    <ProfileQualityLine completion={completion} />
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <span
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            props.onEdit(profile);
                                        }}
                                    >
                                        编辑
                                    </span>
                                    <span
                                        className="text-destructive"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            props.onDelete(profile.id);
                                        }}
                                    >
                                        删
                                    </span>
                                </div>
                            </Button>
                        );
                    })}
                    {!props.profiles.length && (
                        <EmptyState
                            title="还没有档案"
                            text="创建第一个档案后，就可以用它生成今日运势和关系报告。"
                        />
                    )}
                </div>
            </div>

            <form className="rounded-md border bg-card p-4" onSubmit={props.onSubmit}>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                            {props.editingProfileId ? "编辑档案" : "新建档案"}
                        </div>
                        <h2>{props.editingProfileId ? "更新出生信息" : "创建生成基础"}</h2>
                        <p>先填基础项即可开始生成，星座细节可以之后补。</p>
                    </div>
                </div>
                <div className="my-3 text-xs font-semibold text-muted-foreground">基础信息</div>
                <div className="grid gap-3 md:grid-cols-2">
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
                <div className="my-3 text-xs font-semibold text-muted-foreground">增强项</div>
                <div className="grid gap-3 md:grid-cols-3">
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
                    className="font-semibold mt-4"
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
        <section className="rounded-md border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">报告库</div>
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
                    <SelectTrigger className="w-36">
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
            <div className="grid gap-2">
                {reports.map((report) => (
                    <Button
                        key={report.id}
                        className="flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3 text-left hover:border-primary/30 hover:bg-primary/5"
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
                                {reportLabel(report.reportType)} · {formatReportTime(report.createdAt)} ·{" "}
                                {statusLabel(report.status)}
                            </span>
                            <HistoryContextLine report={report} />
                        </div>
                        <div className="shrink-0 text-right max-md:text-left">
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
                <div className="mt-4 flex justify-end">
                    <PaginationComponent />
                </div>
            )}
        </section>
    );
}

function ProfileQualityLine({ completion }: { completion: ProfileCompletion }) {
    const missingText = completion.missing.length
        ? `可补 ${completion.missing.slice(0, 2).join("、")}`
        : "可直接用于高质量生成";
    return (
        <div className="mt-2 flex flex-wrap gap-1.5">
            <span>AI 依据完整度 {completion.percent}%</span>
            <small>{missingText}</small>
        </div>
    );
}

function HistoryContextLine({ report }: { report: AstrologyReport }) {
    const context = report.providerMetadata?.generationContext;
    const details = [
        context?.focusArea ? `范围：${context.focusArea}` : "",
        context?.questionQuality?.level ? `质量：${questionQualityLabel(context.questionQuality.level)} ${context.questionQuality.score ?? ""}%` : "",
        (context?.question || report.question) ? `问题：${context?.question || report.question}` : "",
        context?.currentState ? `状态：${context.currentState}` : "",
        report.costCredits ? `扣费 ${formatCredits(report.costCredits)}` : "",
    ].filter(Boolean);
    return (
        <small className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">
            {details.slice(0, 2).join(" · ") || "打开查看 AI 摘要、依据和行动建议"}
        </small>
    );
}

function ReportPanel({
    report,
    compact,
    generationDisabled,
    generationUnavailableReason,
    onFavorite,
    onCopy,
    onDownload,
    onOpen,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
}: {
    report: AstrologyReport | null;
    compact?: boolean;
    generationDisabled: boolean;
    generationUnavailableReason: string;
    onFavorite: (report: AstrologyReport) => void;
    onCopy: (report: AstrologyReport) => void;
    onDownload: (report: AstrologyReport) => void;
    onOpen: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: ReportFeedbackHandler;
}) {
    const result = report?.result;
    const isRunning = report?.status === "pending" || report?.status === "processing";
    const isFailed = report?.status === "failed";
    return (
        <section className={cn("astro-report-card rounded-md border bg-card p-4", compact && "astro-report-card-compact")}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
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
                    <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={report.status === "failed" ? "destructive" : report.status === "success" ? "default" : "secondary"}>
                            {statusLabel(report.status)}
                        </Badge>
                        <Button
                            className="font-semibold text-muted-foreground"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpen(report)}
                            type="button"
                        >
                            详情
                        </Button>
                    </div>
                )}
            </div>

            {result ? (
                <div className="astro-report-body grid gap-3">
                    <Alert className="border-primary/20 bg-primary/5">
                        <ShieldCheck size={16} />
                        <AlertTitle>AI 摘要结论</AlertTitle>
                        <AlertDescription className="leading-7 text-foreground">{result.summary}</AlertDescription>
                    </Alert>
                    <CompactAiAnchors result={result} compact={compact} />
                    <ReportContextTrail report={report} compact={compact} />
                    <EvidenceList evidence={result.evidence ?? []} compact={compact} />
                    <ReviewChecklistPanel items={result.reviewChecklist ?? []} compact={compact} />
                    {result.sections?.slice(0, compact ? 1 : 2).map((section) => (
                        <article key={section.heading} className="astro-report-section rounded-md border bg-card p-3">
                            <h3>{section.heading}</h3>
                            <p>{section.content}</p>
                        </article>
                    ))}
                    <ActionList items={result.actions ?? []} compact={compact} />
                    <SignalList items={result.warnings ?? []} compact={compact} />
                    {!compact && (
                        <>
                            <div className="grid gap-3 sm:grid-cols-3">
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
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Lucky label="幸运色" value={result.lucky?.color} />
                                <Lucky label="幸运数字" value={result.lucky?.number?.toString()} />
                                <Lucky label="方位" value={result.lucky?.direction} />
                                <Lucky label="时间段" value={result.lucky?.timeRange} />
                            </div>
                        </>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {result.keywords?.slice(0, 6).map((item) => (
                            <Badge key={item} variant="secondary">{item}</Badge>
                        ))}
                    </div>
                    <FollowUpPanel
                        report={report}
                        compact={compact}
                        generationDisabled={generationDisabled}
                        generationUnavailableReason={generationUnavailableReason}
                        onFollowUp={onFollowUp}
                    />
                    <FeedbackPanel report={report} compact={compact} onFeedback={onFeedback} />
                    <div className="flex flex-wrap gap-2">
                        <Action onClick={() => onCopy(report)}>
                            <Copy size={14} />
                            复制
                        </Action>
                        <Action onClick={() => onDownload(report)}>
                            <Download size={14} />
                            下载
                        </Action>
                        <Action onClick={() => onFavorite(report)}>
                            {report.isFavorite ? "取消收藏" : "收藏"}
                        </Action>
                        <Action disabled={generationDisabled || isReportBusy(report.status)} onClick={() => onRegenerate(report)}>
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
                    text="AI 正在读取档案、问题和当前状态，生成完成后会出现在当前卡片和报告库里。"
                >
                    <ProcessPreview
                        items={[
                            "整理本次上下文",
                            "生成判断依据",
                            "拆出行动建议",
                            "写入报告库",
                        ]}
                    />
                </StatusBox>
            ) : isFailed && report ? (
                <StatusBox
                    danger
                    title="这次生成没有完成"
                    text={
                        report.errorMessage ||
                        "模型或队列暂时不可用。失败任务会按账务事实退款，可稍后重试。"
                    }
                >
                    <ProcessPreview
                        items={[
                            "本次结果未入库为成功报告",
                            "可重试同一问题",
                            "失败退款以账务记录为准",
                        ]}
                    />
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
                    text="提交生成后，这里会展示 AI 摘要、判断依据、复盘清单、行动建议、观察信号和继续追问入口。"
                >
                    <ProcessPreview
                        items={[
                            "摘要结论",
                            "判断依据",
                            "复盘清单",
                            "行动建议",
                            "观察信号",
                        ]}
                    />
                </EmptyState>
            )}
        </section>
    );
}

function CompactAiAnchors({ result, compact }: { result: NonNullable<AstrologyReport["result"]>; compact?: boolean }) {
    const scores = Object.entries(result.scores ?? {}).filter(([, value]) => Number.isFinite(value));
    const primaryScore = scores.find(([key]) => key === "overall") ?? scores[0];
    const lucky = result.lucky;
    const scoreValue = primaryScore ? Math.round(primaryScore[1]) : null;
    const anchors = [
        lucky?.color ? `幸运色 ${lucky.color}` : "",
        typeof lucky?.number === "number" ? `幸运数字 ${lucky.number}` : "",
        !compact && lucky?.direction ? `方位 ${lucky.direction}` : "",
        !compact && lucky?.timeRange ? `时间 ${lucky.timeRange}` : "",
    ].filter(Boolean);

    if (!anchors.length && scoreValue === null) return null;
    return (
        <div className="grid gap-3 rounded-md border bg-muted/45 p-3" aria-label="AI锚点">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <ShieldCheck size={14} />
                    AI锚点
                </span>
                {scoreValue !== null && (
                    <Badge variant="outline">
                        {scoreLabel(primaryScore?.[0] ?? "overall")} {scoreValue}%
                    </Badge>
                )}
            </div>
            {scoreValue !== null && <Progress value={Math.max(0, Math.min(100, scoreValue))} />}
            <div className="flex flex-wrap gap-1.5">
                {anchors.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
            </div>
        </div>
    );
}

function ReportContextTrail({
    report,
    compact,
}: {
    report: AstrologyReport;
    compact?: boolean;
}) {
    const source = report.providerMetadata?.sourceReport;
    const context = report.providerMetadata?.generationContext;
    const question = context?.question || report.question;
    const quality = context?.questionQuality;
    const items = [
        `类型：${reportLabel(report.reportType)}`,
        context?.focusArea ? `范围：${context.focusArea}` : "",
        quality?.level ? `问题质量：${questionQualityLabel(quality.level)}${typeof quality.score === "number" ? ` ${quality.score}%` : ""}` : "",
        context?.currentState ? `状态：${context.currentState}` : "",
        question
            ? `问题：${question.slice(0, compact ? 22 : 40)}${question.length > (compact ? 22 : 40) ? "..." : ""}`
            : "问题：使用默认问题",
        source?.title || source?.reportType
            ? `追问来源：${source.title || reportLabel(source.reportType ?? report.reportType)}`
            : "",
        context?.hasTargetProfile ? "包含关系对象" : "",
    ].filter(Boolean);
    return (
        <div className="grid gap-2 rounded-md border bg-muted/45 p-3 text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground">生成依据</div>
                <Badge variant="outline">可追溯</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                    <Badge key={item} variant="secondary" className="h-auto max-w-full justify-start whitespace-normal py-1">
                        {item}
                    </Badge>
                ))}
                <Badge variant="secondary">
                    生成时间：{formatReportTime(report.createdAt)}
                </Badge>
            </div>
            {quality && !compact && (
                <div className="grid gap-2 rounded-md border bg-background p-3 text-xs">
                    <div className="font-semibold text-foreground">AI 输入质量</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <span>已包含：{quality.signals?.join("、") || "暂无"}</span>
                        <span>可补充：{quality.missing?.join("、") || "无需补充"}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function EvidenceList({
    evidence,
    compact,
}: {
    evidence: NonNullable<AstrologyReport["result"]>["evidence"];
    compact?: boolean;
}) {
    const items = (evidence ?? []).slice(0, compact ? 3 : 5);
    if (!items.length) return null;
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground">判断依据</div>
                <Badge variant="outline">{items.length} 条证据</Badge>
            </div>
            <div className="grid gap-2">
                {items.map((item, index) => (
                    <div key={`${item.source}-${index}`} className="rounded-md border bg-muted/35 p-3 text-sm leading-6">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="text-foreground">{item.source}</strong>
                            {item.confidence && (
                                <Badge variant="outline">
                                    {confidenceLabel(item.confidence)}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-1 text-muted-foreground">{item.insight}</p>
                    </div>
                ))}
            </div>
        </div>
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
    const missingItems = completion.missing;
    return (
        <section className="astro-readiness-card grid gap-3 rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <UserRound size={14} /> 素材完整度
                    </div>
                    <h3 className="mt-2 text-lg font-bold">{missingItems.length ? `还可补 ${missingItems.length} 项` : "素材已就绪"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {profile
                            ? `${profile.name} · ${profile.zodiacSign || "星座待补"}`
                            : "先建立档案，再让报告拿到稳定上下文。"}
                    </p>
                </div>
                <strong className="text-2xl tabular-nums">{completion.percent}%</strong>
            </div>
            <div className="astro-meter h-2 overflow-hidden rounded-full bg-muted">
                <span style={{ width: `${completion.percent}%` }} />
            </div>
            <div className="grid gap-2 rounded-md border border-dashed bg-muted/45 p-3 text-sm text-muted-foreground">
                {(missingItems.length ? missingItems : ["姓名", "出生日期", "出生时间", "出生地点"]).map((item) => (
                    <span key={item} className="flex items-center gap-2">
                        <CheckCircle2 className={missingItems.includes(item) ? "text-muted-foreground/40" : "text-primary"} size={14} />
                        {item}
                    </span>
                ))}
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
                <span>{completion.missing.length ? "补全后建议更具体" : "上下文已就绪"}</span>
                <Button
                    className="font-semibold text-muted-foreground"
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

function GenerationFooter({ intent, busy, generationDisabled }: { intent: ReportIntent; busy: boolean; generationDisabled: boolean }) {
    return (
        <div className="mt-4 flex items-center justify-between gap-3">
            <CostHint intent={intent} />
            <Button className="font-semibold" disabled={busy || generationDisabled} loading={busy} type="submit">
                <FileText size={16} />
                生成 {intent.label}
            </Button>
        </div>
    );
}

function GenerationUnavailableNotice({ text, block }: { text?: string; block?: GenerationBlock }) {
    const isWarning = block?.tone === "warning";
    return (
        <div className={cn("flex items-start gap-2 rounded-md border p-3 text-xs", isWarning ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/5 text-muted-foreground")}>
            <AlertCircle size={15} />
            <span>{block?.text || text}</span>
        </div>
    );
}

function CostHint({ intent, compact }: { intent: ReportIntent; compact?: boolean }) {
    return (
        <div className={cn("astro-cost-hint flex flex-wrap gap-1.5", compact && "justify-end")}>
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
    disabled,
    onClick,
}: {
    intent: ReportIntent;
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    const Icon = intent.icon;
    return (
        <Button
            className={cn("min-h-[74px] min-w-[118px] rounded-md border bg-background p-3 text-left text-muted-foreground hover:border-primary/30 hover:bg-primary/5", active && "border-primary/30 bg-primary/5 text-foreground")}
            variant="ghost"
            onClick={onClick}
            disabled={disabled}
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
    disabled,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label className="font-semibold text-foreground">{label}</Label>
            <Input
                className="min-h-10"
                type={type}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function Template({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
    return (
        <Button
            className="font-semibold text-muted-foreground"
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled}
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
        <div className={cn("grid min-h-36 content-center rounded-md border border-dashed bg-muted/35 p-5 text-muted-foreground", danger && "border-destructive/30 bg-destructive/10")}>
            {icon}
            <div>
                <strong className="text-foreground">{title}</strong>
                <p className="max-w-2xl leading-6">{text}</p>
                {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
            </div>
        </div>
    );
}

function EmptyState({
    title,
    text,
    children,
}: {
    title: string;
    text: string;
    children?: ReactNode;
}) {
    return (
        <div className="grid min-h-36 content-center rounded-md border border-dashed bg-muted/35 p-5 text-muted-foreground">
            <div className="grid gap-2">
                <strong className="text-foreground">{title}</strong>
                <p className="max-w-2xl leading-6">{text}</p>
                {children}
            </div>
        </div>
    );
}

function ProcessPreview({ items }: { items: string[] }) {
    return (
        <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((item) => (
                <span key={item} className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">
                    {item}
                </span>
            ))}
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
        <div className="rounded-md border bg-muted p-3 text-muted-foreground">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function Lucky({ label, value }: { label: string; value?: string }) {
    return (
        <div className="rounded-md border bg-muted p-3 text-muted-foreground">
            <span>{label}</span>
            <strong>{value || "--"}</strong>
        </div>
    );
}

function ReviewChecklistPanel({
    items,
    compact,
}: {
    items: NonNullable<AstrologyReport["result"]>["reviewChecklist"];
    compact?: boolean;
}) {
    const idPrefix = useId();
    const visibleItems = (items ?? []).slice(0, compact ? 2 : 4);
    if (!visibleItems.length) return null;
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3">
            <div>
                <div className="font-semibold text-foreground">复盘清单</div>
                {!compact && (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        把 AI 判断转成可观察的行动，稍后用现实反馈验证报告是否有帮助。
                    </p>
                )}
            </div>
            {visibleItems.map((item, index) => {
                const checkboxId = `${idPrefix}-review-checklist-${index}`;
                return (
                <Label key={`${item.item}-${index}`} htmlFor={checkboxId} className="grid gap-1 rounded-md border bg-muted/35 p-3 text-sm leading-6 text-muted-foreground">
                    <span className="flex items-start gap-2 font-medium text-foreground">
                        <Checkbox id={checkboxId} className="mt-1" />
                        <span>{item.item}</span>
                    </span>
                    <span>依据：{item.evidenceSource}</span>
                    <span>验证点：{item.why}</span>
                    {item.timebox && <span>时间：{item.timebox}</span>}
                </Label>
                );
            })}
        </div>
    );
}

function ActionList({ items, compact }: { items: ReportActionItem[]; compact?: boolean }) {
    const idPrefix = useId();
    if (!items.length) return null;
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground">下一步行动</div>
                <Badge variant="outline">可执行</Badge>
            </div>
            {items.slice(0, compact ? 3 : 5).map((item, index) => {
                const checkboxId = `${idPrefix}-action-list-${index}`;
                const label = formatActionItem(item);
                return (
                <Label key={`${label}-${index}`} htmlFor={checkboxId} className="grid gap-1 rounded-md border bg-muted/35 p-3 text-sm leading-6 text-muted-foreground">
                    <span className="flex items-start gap-2 font-medium text-foreground">
                    <Checkbox id={checkboxId} className="mt-1" />
                        <span>{getActionItemTitle(item)}</span>
                    </span>
                    {typeof item !== "string" && item.reason && <span>原因：{item.reason}</span>}
                    {typeof item !== "string" && item.timebox && <span>时间：{item.timebox}</span>}
                </Label>
                );
            })}
        </div>
    );
}

function SignalList({ items, compact }: { items: ReportWarningItem[]; compact?: boolean }) {
    if (!items.length) return null;
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground">观察信号</div>
                <Badge variant="outline">风险校验</Badge>
            </div>
            {items.slice(0, compact ? 2 : 4).map((item, index) => {
                const label = formatWarningItem(item);
                return (
                <div key={`${label}-${index}`} className="grid gap-1 rounded-md border bg-muted/35 p-3 text-sm leading-6 text-muted-foreground">
                    <div className="flex items-start gap-2 font-medium text-foreground">
                        <AlertCircle className="mt-1 shrink-0 text-primary" size={14} />
                        <span>{getWarningItemTitle(item)}</span>
                    </div>
                    {typeof item !== "string" && item.detail && <span>{item.detail}</span>}
                </div>
                );
            })}
        </div>
    );
}

type QuestionQuality = {
    score: number;
    checks: Array<{ label: string; passed: boolean }>;
};

function QuestionQualityPanel({ quality }: { quality: QuestionQuality }) {
    const includedChecks = quality.checks.filter((check) => check.passed);
    const missingChecks = quality.checks.filter((check) => !check.passed);
    return (
        <div className="mt-4 grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
                <div className="font-semibold text-foreground">问题质量</div>
                <p>影响输出：AI 会优先把高质量问题转成判断依据、行动建议和复盘清单。</p>
            </div>
            <div className="rounded-md bg-primary/10 p-3 text-center text-primary">
                <strong>{quality.score}%</strong>
                <span>可用度</span>
            </div>
            <div className="grid gap-2 rounded-md border bg-muted/35 p-3 text-sm sm:col-span-2 sm:grid-cols-2">
                <div>
                    <strong className="text-foreground">已包含</strong>
                    <p>{includedChecks.map((check) => check.label).join("、") || "还需要补充更多上下文"}</p>
                </div>
                <div>
                    <strong className="text-foreground">建议补充</strong>
                    <p>{missingChecks.map((check) => check.label).join("、") || "问题已经足够具体"}</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                {quality.checks.map((check) => (
                    <span key={check.label} className={cn("rounded-full border px-2 py-1 text-xs text-muted-foreground", check.passed && "border-primary/20 bg-primary/5 text-primary")}>
                        {check.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function CompletionMeter({
    title,
    completion,
    text,
}: {
    title: string;
    completion: ProfileCompletion;
    text: string;
}) {
    return (
        <div className="grid gap-2 rounded-md border bg-muted p-3 text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
                <strong>{title}</strong>
                <span>{completion.percent}%</span>
            </div>
            <div className="astro-meter h-2 overflow-hidden rounded-full bg-muted">
                <span style={{ width: `${completion.percent}%` }} />
            </div>
            <p>{completion.missing.length ? `建议补充：${completion.missing.join("、")}` : text}</p>
        </div>
    );
}

function FollowUpPanel({
    report,
    compact,
    generationDisabled,
    generationUnavailableReason,
    onFollowUp,
}: {
    report: AstrologyReport;
    compact?: boolean;
    generationDisabled: boolean;
    generationUnavailableReason: string;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
}) {
    const fallbackPrompts = [
        "基于「{title}」，帮我拆成今天能执行的 3 个行动。",
        "基于「{title}」，哪些判断最不确定？我应该观察什么信号？",
        "基于「{title}」，把建议改成更直接的沟通话术。",
    ];
    const prompts = report.result?.followUps?.length ? report.result.followUps : fallbackPrompts;
    return (
        <div className="grid gap-2 rounded-md border bg-card p-3">
            <div>
                <div className="font-semibold text-foreground">继续追问</div>
                {!compact && <p>优先使用本次报告生成的追问建议，并带着当前报告上下文回到问问区。</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {prompts.slice(0, compact ? 2 : prompts.length).map((prompt) => (
                    <Button
                        key={prompt}
                        className="font-semibold text-muted-foreground"
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={generationDisabled}
                        onClick={() => onFollowUp(report, prompt)}
                    >
                        {prompt.replace("「{title}」", "这份报告")}
                    </Button>
                ))}
            </div>
            {generationDisabled && <GenerationUnavailableNotice text={generationUnavailableReason} />}
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
    onFeedback: ReportFeedbackHandler;
}) {
    const selected = report.providerMetadata?.feedback?.rating;
    const savedNote = report.providerMetadata?.feedback?.note ?? "";
    const [feedbackNote, setFeedbackNote] = useState(report.providerMetadata?.feedback?.note ?? "");
    const noteId = useId();
    useEffect(() => {
        setFeedbackNote(savedNote);
    }, [report.id, savedNote]);
    return (
        <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3 max-sm:grid">
                <div>
                    <div className="font-semibold text-foreground">报告反馈</div>
                    <p>这条备注会进入下一次追问或同类报告的 AI 质量参考。</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                    {feedbackOptions.map((option) => (
                        <Button
                            key={option.value}
                            className={cn(selected === option.value && "border-primary/30 bg-primary/5 text-foreground")}
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => onFeedback(report, option.value, feedbackNote.trim() || undefined)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor={noteId} className="text-xs text-muted-foreground">
                    反馈备注
                </Label>
                <Textarea
                    id={noteId}
                    value={feedbackNote}
                    onChange={(event) => setFeedbackNote(event.target.value)}
                    placeholder="哪里太泛、哪里有用？写一句真实反馈，方便后续 AI 继续校准。"
                    rows={compact ? 2 : 3}
                />
            </div>
        </div>
    );
}

function ReportDetailModal({
    report,
    onClose,
    onCopy,
    onDownload,
    onFavorite,
    onDelete,
    onRegenerate,
    onFollowUp,
    onFeedback,
    generationDisabled,
    generationUnavailableReason,
}: {
    report: AstrologyReport | null;
    onClose: () => void;
    onCopy: (report: AstrologyReport) => void;
    onDownload: (report: AstrologyReport) => void;
    onFavorite: (report: AstrologyReport) => void;
    onDelete: (id: string) => void;
    onRegenerate: (report: AstrologyReport) => void;
    onFollowUp: (report: AstrologyReport, prompt: string) => void;
    onFeedback: ReportFeedbackHandler;
    generationDisabled: boolean;
    generationUnavailableReason: string;
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
                                {reportLabel(report.reportType)} · {formatReportTime(report.createdAt)} ·
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
                    <div className="astro-report-body space-y-5">
                        <Alert className="border-primary/20 bg-primary/5">
                            <ShieldCheck size={16} />
                            <AlertTitle>AI 摘要结论</AlertTitle>
                            <AlertDescription className="leading-7 text-foreground">{result.summary}</AlertDescription>
                        </Alert>
                        <ReportContextTrail report={report} />
                        <EvidenceList evidence={result.evidence ?? []} />
                        <ReviewChecklistPanel items={result.reviewChecklist ?? []} />
                        {result.sections?.map((section) => (
                            <article key={section.heading} className="astro-report-section rounded-md border bg-muted/35 p-3">
                                <h3>{section.heading}</h3>
                                <p>{section.content}</p>
                            </article>
                        ))}
                        <ActionList items={result.actions ?? []} />
                        <SignalList items={result.warnings ?? []} />
                        <div className="grid gap-3 sm:grid-cols-3">
                            {Object.entries(result.scores ?? {}).map(([key, value]) => (
                                <Metric
                                    key={key}
                                    label={scoreLabel(key)}
                                    value={`${Math.round(value)}%`}
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {result.keywords?.map((item) => (
                                <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                        </div>
                        <FollowUpPanel
                            report={report}
                            generationDisabled={generationDisabled}
                            generationUnavailableReason={generationUnavailableReason}
                            onFollowUp={(nextReport, prompt) => {
                                onClose();
                                onFollowUp(nextReport, prompt);
                            }}
                        />
                        <FeedbackPanel report={report} onFeedback={onFeedback} />
                        {result.closing && <div className="rounded-md border bg-card p-3 leading-7 text-muted-foreground">{result.closing}</div>}
                    </div>
                )}
                {report && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        <Action onClick={() => onCopy(report)}>
                            <Copy size={14} />
                            复制
                        </Action>
                        <Action onClick={() => onDownload(report)}>
                            <Download size={14} />
                            下载
                        </Action>
                        <Action onClick={() => onFavorite(report)}>
                            {report.isFavorite ? "取消收藏" : "收藏"}
                        </Action>
                        <Action disabled={generationDisabled || isReportBusy(report.status)} onClick={() => onRegenerate(report)}>
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

function getReportExportText(report: AstrologyReport) {
    return formatReportResultForExport(report.result) || report.resultText || "";
}

function formatReportResultForExport(result?: AstrologyReport["result"] | null) {
    if (!result) return "";
    const lines = [`# ${result.title}`, "", result.summary, ""];
    if (result.keywords?.length) {
        lines.push(`关键词：${result.keywords.join("、")}`, "");
    }
    const scores = Object.entries(result.scores ?? {});
    if (scores.length) {
        lines.push("## 评分");
        for (const [key, value] of scores) {
            lines.push(`- ${scoreLabel(key)}：${Math.round(value)}%`);
        }
        lines.push("");
    }
    if (result.lucky) {
        const luckyLines = [
            result.lucky.color ? `- 幸运色：${result.lucky.color}` : "",
            typeof result.lucky.number === "number" ? `- 幸运数字：${result.lucky.number}` : "",
            result.lucky.direction ? `- 方位：${result.lucky.direction}` : "",
            result.lucky.timeRange ? `- 时间段：${result.lucky.timeRange}` : "",
        ].filter(Boolean);
        if (luckyLines.length) lines.push("## 幸运锚点", ...luckyLines, "");
    }
    if (result.evidence?.length) {
        lines.push("## 判断依据");
        for (const item of result.evidence) {
            const confidence = item.confidence ? `（${confidenceLabel(item.confidence)}）` : "";
            lines.push(`- ${item.source}${confidence}：${item.insight}`);
        }
        lines.push("");
    }
    for (const section of result.sections ?? []) {
        lines.push(`## ${section.heading}`, section.content, "");
    }
    if (result.actions?.length) {
        lines.push("## 行动建议", ...result.actions.map((item) => `- ${formatActionItem(item)}`), "");
    }
    if (result.warnings?.length) {
        lines.push("## 风险提醒", ...result.warnings.map((item) => `- ${formatWarningItem(item)}`), "");
    }
    if (result.reviewChecklist?.length) {
        lines.push("## 复盘清单");
        for (const item of result.reviewChecklist) {
            const timebox = item.timebox ? `[${item.timebox}] ` : "";
            lines.push(`- ${timebox}${item.item}`);
            lines.push(`  依据：${item.evidenceSource}；验证点：${item.why}`);
        }
        lines.push("");
    }
    if (result.followUps?.length) {
        lines.push("## 继续追问", ...result.followUps.map((item) => `- ${item}`), "");
    }
    lines.push(result.closing || "");
    return lines.join("\n").trim();
}

type ProfileCompletion = { percent: number; missing: string[] };

function getGenerationBlock({
    profile,
    profileInput,
    generationDisabled,
    generationUnavailableReason,
}: {
    profile: AstrologyProfile | null;
    profileInput: Partial<AstrologyProfileInput>;
    generationDisabled: boolean;
    generationUnavailableReason: string;
}): GenerationBlock | null {
    const requiredMissing = getRequiredProfileMissing(profileInput);
    if (requiredMissing.length) {
        return {
            title: profile ? `还差 ${requiredMissing.join("、")}` : "请先填写基础档案",
            text: "姓名和出生日期即可生成；出生时间、地点和星座信息可提升精度。",
            actionLabel: profile ? "去完善档案" : "去创建档案",
        };
    }
    if (generationDisabled) {
        return {
            title: "生成服务暂不可用",
            text: generationUnavailableReason,
            actionLabel: "稍后再试",
            tone: "warning",
        };
    }
    return null;
}

function getRequiredProfileMissing(profile: Partial<AstrologyProfileInput>) {
    return ([
        ["name", "姓名"],
        ["birthDate", "出生日期"],
    ] as const)
        .filter(([key]) => !String(profile[key] ?? "").trim())
        .map(([, label]) => label);
}

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

function calculatePartnerCompletion(partner: PartnerInput): ProfileCompletion {
    const fields: Array<[keyof PartnerInput, string]> = [
        ["name", "称呼"],
        ["birthDate", "出生日期"],
        ["birthTime", "出生时间"],
        ["birthPlace", "出生地点"],
        ["zodiacSign", "星座"],
        ["relationshipStatus", "关系场景"],
    ];
    const filled = fields.filter(([key]) => Boolean(partner[key]));
    const missing = fields.filter(([key]) => !partner[key]).map(([, label]) => label);
    return { percent: Math.round((filled.length / fields.length) * 100), missing };
}

function getQuestionQuality(input: {
    reportType: AstrologyReportType;
    focusArea: string;
    currentState: string;
    question: string;
}): QuestionQuality {
    const quality = buildAstrologyQuestionQualityContext(input);
    return {
        score: quality.score,
        checks: quality.signals.map((signal) => ({ label: signal.label, passed: signal.present })),
    };
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

function questionQualityLabel(level: "weak" | "usable" | "strong") {
    return (
        {
            weak: "需补充",
            usable: "可使用",
            strong: "信息充分",
        }[level] ?? "可使用"
    );
}

function confidenceLabel(confidence: "low" | "medium" | "high") {
    return (
        {
            low: "低置信",
            medium: "中置信",
            high: "高置信",
        }[confidence] ?? "参考"
    );
}

function isReportBusy(status: AstrologyReport["status"]) {
    return status === "pending" || status === "processing";
}

function formatActionItem(item: ReportActionItem) {
    if (typeof item === "string") return item;
    return [item.item, item.reason, item.timebox].filter(Boolean).join(" · ");
}

function getActionItemTitle(item: ReportActionItem) {
    return typeof item === "string" ? item : item.item;
}

function formatWarningItem(item: ReportWarningItem) {
    if (typeof item === "string") return item;
    return [item.title, item.detail].filter(Boolean).join(" · ");
}

function getWarningItemTitle(item: ReportWarningItem) {
    return typeof item === "string" ? item : item.title;
}

function formatReportTime(value?: string | null) {
    return formatDateTime(value, "未知时间");
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
