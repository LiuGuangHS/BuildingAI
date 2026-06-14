import { Briefcase, CalendarDays, Copy, Heart, MessageCircleQuestion, Plus, RefreshCw, Star, Trash2, UserRound, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
    useAstrologyProfilesQuery,
    useAstrologyReportsQuery,
    useCreateAstrologyProfileMutation,
    useDeleteAstrologyProfileMutation,
    useDeleteAstrologyReportMutation,
    useGenerateAstrologyReportMutation,
    useUpdateAstrologyProfileMutation,
    useUpdateReportFavoriteMutation,
} from "../services/web/astrology-fortune";
import type { AstrologyProfile, AstrologyProfileInput, AstrologyReport, AstrologyReportType, GenerateAstrologyReportParams } from "../services/types";

type ReportIntent = {
    value: AstrologyReportType;
    label: string;
    subtitle: string;
    icon: typeof Star;
    focusArea: string;
    currentState: string;
    question: string;
};

type PartnerInput = {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    zodiacSign: string;
    relationshipStatus: string;
};

const reportIntents: ReportIntent[] = [
    { value: "daily", label: "今日运势", subtitle: "一键生成今日能量与行动建议", icon: CalendarDays, focusArea: "今日综合运势", currentState: "想知道今天适合推进什么", question: "今天我最应该把注意力放在哪里？" },
    { value: "personality", label: "性格画像", subtitle: "长期性格、优势与情绪模式", icon: UserRound, focusArea: "性格与长期画像", currentState: "想更理解自己的行为模式", question: "请分析我的核心性格、优势、挑战和适合的发展方向。" },
    { value: "love", label: "感情分析", subtitle: "关系状态、吸引模式与沟通建议", icon: Heart, focusArea: "感情与亲密关系", currentState: "想理解当前感情状态", question: "请分析我近期的感情能量、关系模式和适合采取的行动。" },
    { value: "career", label: "事业财富", subtitle: "职业阶段、机会、财务倾向", icon: Briefcase, focusArea: "事业与财富", currentState: "想找到更清晰的事业节奏", question: "请分析我近期的事业财富趋势、机会和需要规避的风险。" },
    { value: "compatibility", label: "星座配对", subtitle: "双人吸引力、稳定性与雷区", icon: Star, focusArea: "关系配对", currentState: "想了解双方关系匹配度", question: "请分析我和对方的关系匹配度、吸引力、冲突来源和相处建议。" },
    { value: "decision", label: "决策占卜", subtitle: "针对具体问题给出理性行动建议", icon: MessageCircleQuestion, focusArea: "生活决策", currentState: "正在做一个重要选择", question: "我现在应该如何做这个决定？请给出倾向建议、理由、风险和未来7天观察点。" },
];

const defaultIntent = reportIntents[0] as ReportIntent;

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

export default function AstrologyFortuneHomePage() {
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
    const [historyType, setHistoryType] = useState<AstrologyReportType | "all" | "favorite">("all");
    const [notice, setNotice] = useState<string | null>(null);

    const profilesQuery = useAstrologyProfilesQuery();
    const reportsQuery = useAstrologyReportsQuery({ pageSize: 50, reportType: historyType !== "all" && historyType !== "favorite" ? historyType : undefined, isFavorite: historyType === "favorite" ? true : undefined });
    const createProfileMutation = useCreateAstrologyProfileMutation();
    const updateProfileMutation = useUpdateAstrologyProfileMutation();
    const deleteProfileMutation = useDeleteAstrologyProfileMutation();
    const generateReportMutation = useGenerateAstrologyReportMutation();
    const favoriteMutation = useUpdateReportFavoriteMutation();
    const deleteReportMutation = useDeleteAstrologyReportMutation();

    const profiles = profilesQuery.data?.items ?? [];
    const reports = reportsQuery.data?.items ?? [];
    const selectedProfile = profiles.find((item) => item.id === selectedProfileId) ?? profiles[0] ?? null;
    const latestSuccessfulReport = reports.find((item) => item.status === "success" && item.result);
    const currentReport = activeReport ?? latestSuccessfulReport ?? null;
    const currentIntent = reportIntents.find((item) => item.value === reportType) ?? defaultIntent;
    const busy = createProfileMutation.isPending || updateProfileMutation.isPending || generateReportMutation.isPending;

    const profileStats = useMemo(() => ({ total: profiles.length, favoriteReports: reports.filter((item) => item.isFavorite).length }), [profiles.length, reports]);

    useEffect(() => {
        if (!selectedProfileId && profiles[0]) setSelectedProfileId(profiles[0].id);
    }, [profiles, selectedProfileId]);

    useEffect(() => {
        if (!activeReport && latestSuccessfulReport) setActiveReport(latestSuccessfulReport);
    }, [activeReport, latestSuccessfulReport]);

    useEffect(() => {
        if (!activeReport) return;
        const freshReport = reports.find((item) => item.id === activeReport.id);
        if (freshReport && freshReport.updatedAt !== activeReport.updatedAt) setActiveReport(freshReport);
    }, [activeReport, reports]);

    useEffect(() => {
        if (!detailReport) return;
        const freshReport = reports.find((item) => item.id === detailReport.id);
        if (freshReport && freshReport.updatedAt !== detailReport.updatedAt) setDetailReport(freshReport);
    }, [detailReport, reports]);

    function selectIntent(intent: ReportIntent) {
        setReportType(intent.value);
        setFocusArea(intent.focusArea);
        setCurrentState(intent.currentState);
        setQuestion(intent.question);
    }

    function editProfile(profile: AstrologyProfile) {
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
        setNotice(null);
        try {
            const saved = editingProfileId
                ? await updateProfileMutation.mutateAsync({ profileId: editingProfileId, params: profileForm })
                : await createProfileMutation.mutateAsync(profileForm);
            setSelectedProfileId(saved.id);
            setNotice(editingProfileId ? "档案已更新" : "档案已创建");
            resetProfileForm();
        } catch (error) {
            setNotice(getErrorMessage(error, "档案保存失败"));
        }
    }

    async function handleDeleteProfile(profileId: string) {
        try {
            await deleteProfileMutation.mutateAsync(profileId);
            if (selectedProfileId === profileId) setSelectedProfileId(null);
            setNotice("档案已删除");
        } catch (error) {
            setNotice(getErrorMessage(error, "档案删除失败"));
        }
    }

    async function handleGenerateReport(event?: FormEvent) {
        event?.preventDefault();
        setNotice(null);
        try {
            const profile = selectedProfile ?? (await createProfileMutation.mutateAsync(profileForm));
            setSelectedProfileId(profile.id);
            const params: GenerateAstrologyReportParams = { reportType, profileId: profile.id, focusArea, currentState, question, language: "zh-CN" };
            if (reportType === "compatibility") {
                params.targetProfile = partner;
                params.question = `${question}\n关系状态：${partner.relationshipStatus}\n对方：${partner.name}，生日：${partner.birthDate}，星座：${partner.zodiacSign || "请自动推算"}，出生地：${partner.birthPlace || "未填写"}`;
            }
            const report = await generateReportMutation.mutateAsync(params);
            setActiveReport(report);
            setDetailReport(report);
            setNotice("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            setNotice(getErrorMessage(error, "报告生成失败"));
        }
    }

    async function handleRegenerate(report: AstrologyReport) {
        setReportType(report.reportType);
        setQuestion(report.question || currentIntent.question);
        setHistoryType("all");
        try {
            const regenerated = await generateReportMutation.mutateAsync({ reportType: report.reportType, profileId: report.profileId ?? selectedProfile?.id ?? undefined, focusArea: report.tags?.[1], question: report.question ?? undefined, language: "zh-CN" });
            setActiveReport(regenerated);
            setDetailReport(regenerated);
            setNotice("报告任务已提交，生成完成后会自动刷新。");
        } catch (error) {
            setNotice(getErrorMessage(error, "重新生成失败"));
        }
    }

    async function handleDeleteReport(reportId: string) {
        try {
            await deleteReportMutation.mutateAsync(reportId);
            if (activeReport?.id === reportId) setActiveReport(null);
            if (detailReport?.id === reportId) setDetailReport(null);
            setNotice("报告已删除");
        } catch (error) {
            setNotice(getErrorMessage(error, "报告删除失败"));
        }
    }

    async function copyReport(report: AstrologyReport) {
        try {
            await navigator.clipboard.writeText(report.resultText || report.result?.summary || "");
            setNotice("报告内容已复制");
        } catch (error) {
            setNotice(getErrorMessage(error, "复制失败"));
        }
    }

    async function handleFavorite(report: AstrologyReport) {
        try {
            await favoriteMutation.mutateAsync({ reportId: report.id, isFavorite: !report.isFavorite });
            setNotice(report.isFavorite ? "已取消收藏" : "已收藏报告");
        } catch (error) {
            setNotice(getErrorMessage(error, "收藏操作失败"));
        }
    }

    return (
        <main className="astro-shell">
            <style>{styles}</style>
            <div className="astro-bg" />
            <section className="astro-page">
                <div className="astro-topline"><Brand /><ProfileSummary profile={selectedProfile} profileStats={profileStats} /></div>
                <Hero report={currentReport} reportType={currentIntent.label} reportCount={reports.length} />
                <nav className="intent-tabs">
                    {reportIntents.map((item) => <IntentButton key={item.value} intent={item} active={reportType === item.value} onClick={() => selectIntent(item)} />)}
                </nav>

                <section className="astro-grid">
                    <div className="space-y-6">
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
                        <ReportComposer
                            intent={currentIntent}
                            focusArea={focusArea}
                            currentState={currentState}
                            question={question}
                            partner={partner}
                            busy={busy}
                            hasProfile={!!selectedProfile || !!profileForm.birthDate}
                            onFocusAreaChange={setFocusArea}
                            onCurrentStateChange={setCurrentState}
                            onQuestionChange={setQuestion}
                            onPartnerChange={setPartner}
                            onSubmit={handleGenerateReport}
                        />
                    </div>

                    <div className="space-y-6">
                        {notice && <div className="notice-card">{notice}</div>}
                        <ReportPanel report={currentReport} onFavorite={handleFavorite} onCopy={copyReport} onOpen={setDetailReport} onDelete={handleDeleteReport} onRegenerate={handleRegenerate} />
                        <HistoryPanel reports={reports} activeType={historyType} onTypeChange={setHistoryType} onOpen={setDetailReport} />
                    </div>
                </section>
            </section>
            {detailReport && <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} onCopy={copyReport} onFavorite={handleFavorite} onDelete={handleDeleteReport} onRegenerate={handleRegenerate} />}
        </main>
    );
}

function Brand() {
    return <div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">✦</div><div><div className="text-lg font-bold">星盘运势</div><div className="text-xs text-violet-200/70">Astro Intelligence</div></div></div>;
}

function IntentButton({ intent, active, onClick }: { intent: ReportIntent; active: boolean; onClick: () => void }) {
    const Icon = intent.icon;
    return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} type="button"><Icon size={16} /><span><span className="block">{intent.label}</span><span className="block text-xs opacity-60">{intent.subtitle}</span></span></button>;
}

function ProfileSummary({ profile, profileStats }: { profile: AstrologyProfile | null; profileStats: { total: number; favoriteReports: number } }) {
    return <div className="mt-8 rounded-3xl border border-violet-300/20 bg-violet-400/10 p-4"><div className="text-sm font-semibold text-violet-100">当前档案</div><div className="mt-3 text-2xl font-bold">{profile?.zodiacSign || "待生成"}</div><div className="mt-1 text-sm text-violet-200/70">{profile?.name || "暂无档案"} · 生肖 {profile?.chineseZodiac || "-"}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-violet-100/70"><span>档案 {profileStats.total}</span><span>收藏 {profileStats.favoriteReports}</span></div></div>;
}

function Hero({ report, reportType, reportCount }: { report: AstrologyReport | null; reportType: string; reportCount: number }) {
    return <header className="rounded-[32px] border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-violet-950/30 backdrop-blur-xl"><div className="mb-4 inline-flex rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-sm text-fuchsia-100">AI 命理画像 · 每日运势 · 关系匹配 · 决策建议</div><h1 className="text-5xl font-black tracking-tight max-md:text-4xl">AI星盘运势</h1><p className="mt-4 max-w-2xl text-base leading-7 text-violet-100/72">把星座、生肖、出生信息和当前问题合并为长期个性档案，生成可执行的生活、事业、情感与关系建议。</p><div className="mt-6 grid grid-cols-3 gap-3 max-md:grid-cols-1"><Metric label="整体能量" value={report?.score ? `${report.score}%` : "--"} /><Metric label="报告类型" value={reportType} /><Metric label="历史报告" value={`${reportCount}`} /></div></header>;
}

function ProfileManager(props: { profiles: AstrologyProfile[]; selectedProfileId: string | null; profileForm: AstrologyProfileInput; editingProfileId: string | null; busy: boolean; onSelect: (id: string) => void; onEdit: (profile: AstrologyProfile) => void; onDelete: (id: string) => void; onReset: () => void; onSubmit: (event: FormEvent) => void; onChange: (profile: AstrologyProfileInput) => void }) {
    return <section className="panel"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">星盘档案</h2><p className="mt-1 text-sm text-violet-200/65">可创建多个档案，用于自己、伴侣或合作对象。</p></div><button className="secondary-btn" onClick={props.onReset} type="button"><Plus size={16} /> 新档案</button></div><div className="mb-5 grid grid-cols-2 gap-3 max-md:grid-cols-1">{props.profiles.map((profile) => <button key={profile.id} className={`profile-card ${props.selectedProfileId === profile.id ? "active" : ""}`} onClick={() => props.onSelect(profile.id)} type="button"><div><div className="font-bold">{profile.name}</div><div className="mt-1 text-xs text-violet-200/65">{profile.zodiacSign} · 生肖{profile.chineseZodiac}</div><div className="mt-1 text-xs text-violet-200/45">{profile.birthDate} {profile.birthPlace || ""}</div></div><div className="flex gap-1"><span onClick={(event) => { event.stopPropagation(); props.onEdit(profile); }} className="mini-action">编辑</span><span onClick={(event) => { event.stopPropagation(); props.onDelete(profile.id); }} className="mini-action danger">删</span></div></button>)}{!props.profiles.length && <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-violet-200/60">还没有档案，先创建一个。</div>}</div><form onSubmit={props.onSubmit}><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label="姓名/档案名" value={props.profileForm.name} onChange={(value) => props.onChange({ ...props.profileForm, name: value })} /><Field label="出生日期" value={props.profileForm.birthDate} onChange={(value) => props.onChange({ ...props.profileForm, birthDate: value })} type="date" /><Field label="出生时间" value={props.profileForm.birthTime || ""} onChange={(value) => props.onChange({ ...props.profileForm, birthTime: value })} type="time" /><Field label="出生地点" value={props.profileForm.birthPlace || ""} onChange={(value) => props.onChange({ ...props.profileForm, birthPlace: value })} /><Field label="性别" value={props.profileForm.gender || ""} onChange={(value) => props.onChange({ ...props.profileForm, gender: value })} placeholder="可选" /><Field label="太阳星座" value={props.profileForm.zodiacSign || ""} onChange={(value) => props.onChange({ ...props.profileForm, zodiacSign: value })} placeholder="留空自动推算" /><Field label="月亮星座" value={props.profileForm.moonSign || ""} onChange={(value) => props.onChange({ ...props.profileForm, moonSign: value })} placeholder="可选" /><Field label="上升星座" value={props.profileForm.risingSign || ""} onChange={(value) => props.onChange({ ...props.profileForm, risingSign: value })} placeholder="可选" /></div><button className="primary-btn mt-4" disabled={props.busy} type="submit">{props.editingProfileId ? "保存档案" : "创建档案"}</button></form></section>;
}

function ReportComposer(props: { intent: ReportIntent; focusArea: string; currentState: string; question: string; partner: PartnerInput; busy: boolean; hasProfile: boolean; onFocusAreaChange: (value: string) => void; onCurrentStateChange: (value: string) => void; onQuestionChange: (value: string) => void; onPartnerChange: (value: PartnerInput) => void; onSubmit: (event: FormEvent) => void }) {
    return <form className="panel" onSubmit={props.onSubmit}><div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start"><div><h2 className="text-xl font-bold">{props.intent.label}</h2><p className="mt-1 text-sm text-violet-200/65">{props.intent.subtitle}。模型由管理员后台固定配置。</p></div><button className="primary-btn" disabled={props.busy || !props.hasProfile} type="submit">{props.busy ? "生成中..." : "一键生成"}</button></div><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label="关注方向" value={props.focusArea} onChange={props.onFocusAreaChange} /><Field label="当前状态" value={props.currentState} onChange={props.onCurrentStateChange} /></div>{props.intent.value === "compatibility" && <PartnerFields partner={props.partner} onChange={props.onPartnerChange} />}{props.intent.value === "decision" && <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-violet-100/70 max-md:grid-cols-1"><Template onClick={() => props.onQuestionChange("我最近适合换工作吗？请结合风险和未来7天观察点分析。")}>换工作</Template><Template onClick={() => props.onQuestionChange("我该不该主动联系 TA？请给出行动建议和注意事项。")}>联系TA</Template><Template onClick={() => props.onQuestionChange("现在适合推进合作或创业吗？请分析机会与风险。")}>合作创业</Template></div>}<label className="mt-4 block text-sm text-violet-100/80">具体问题<textarea className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none ring-fuchsia-400/40 transition focus:ring-2" value={props.question} onChange={(event) => props.onQuestionChange(event.target.value)} /></label></form>;
}

function PartnerFields({ partner, onChange }: { partner: PartnerInput; onChange: (value: PartnerInput) => void }) {
    return <div className="mt-4 rounded-3xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-4"><div className="mb-3 text-sm font-bold text-fuchsia-100">配对对象</div><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><Field label="对方昵称" value={partner.name} onChange={(value) => onChange({ ...partner, name: value })} /><Field label="对方生日" value={partner.birthDate} onChange={(value) => onChange({ ...partner, birthDate: value })} type="date" /><Field label="出生时间" value={partner.birthTime} onChange={(value) => onChange({ ...partner, birthTime: value })} type="time" /><Field label="出生地点" value={partner.birthPlace} onChange={(value) => onChange({ ...partner, birthPlace: value })} /><Field label="对方星座" value={partner.zodiacSign} onChange={(value) => onChange({ ...partner, zodiacSign: value })} placeholder="可选" /><Field label="关系状态" value={partner.relationshipStatus} onChange={(value) => onChange({ ...partner, relationshipStatus: value })} /></div></div>;
}

function ReportPanel({ report, onFavorite, onCopy, onOpen, onDelete, onRegenerate }: { report: AstrologyReport | null; onFavorite: (report: AstrologyReport) => void; onCopy: (report: AstrologyReport) => void; onOpen: (report: AstrologyReport) => void; onDelete: (id: string) => void; onRegenerate: (report: AstrologyReport) => void }) {
    const result = report?.result;
    return <section className="rounded-[32px] border border-white/10 bg-[#120d2d]/95 p-6 shadow-2xl shadow-fuchsia-950/20"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-sm text-fuchsia-200/80">当前报告</div><h2 className="mt-1 text-2xl font-black">{result?.title || "等待生成你的专属报告"}</h2></div>{report && <div className="flex flex-wrap justify-end gap-2"><Action onClick={() => onOpen(report)}>详情</Action><Action onClick={() => onFavorite(report)}>{report.isFavorite ? "取消收藏" : "收藏"}</Action></div>}</div>{result ? <div className="space-y-5"><p className="leading-7 text-violet-100/78">{result.summary}</p><div className="grid grid-cols-3 gap-3">{Object.entries(result.scores ?? {}).slice(0, 6).map(([key, value]) => <Metric key={key} label={scoreLabel(key)} value={`${Math.round(value)}%`} />)}</div><div className="flex flex-wrap gap-2">{result.keywords?.map((item) => <span key={item} className="rounded-full bg-fuchsia-300/10 px-3 py-1 text-sm text-fuchsia-100">{item}</span>)}</div><div className="grid grid-cols-2 gap-3 text-sm max-md:grid-cols-1"><Lucky label="幸运色" value={result.lucky?.color} /><Lucky label="幸运数字" value={result.lucky?.number?.toString()} /><Lucky label="方位" value={result.lucky?.direction} /><Lucky label="时间段" value={result.lucky?.timeRange} /></div>{result.sections?.slice(0, 3).map((section) => <article key={section.heading} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><h3 className="font-bold text-fuchsia-100">{section.heading}</h3><p className="mt-2 text-sm leading-7 text-violet-100/75">{section.content}</p></article>)}<div className="flex flex-wrap gap-2"><Action onClick={() => onCopy(report!)}><Copy size={14} />复制</Action><Action onClick={() => onRegenerate(report!)}><RefreshCw size={14} />重生成</Action><Action danger onClick={() => onDelete(report!.id)}><Trash2 size={14} />删除</Action></div></div> : <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-violet-200/65">创建或选择档案，然后生成第一份 AI 星盘运势报告。</div>}</section>;
}

function HistoryPanel({ reports, activeType, onTypeChange, onOpen }: { reports: AstrologyReport[]; activeType: AstrologyReportType | "all" | "favorite"; onTypeChange: (type: AstrologyReportType | "all" | "favorite") => void; onOpen: (report: AstrologyReport) => void }) {
    return <section className="rounded-[32px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">历史报告</h2><select className="rounded-full border border-white/10 bg-[#171136] px-3 py-2 text-sm text-white outline-none" value={activeType} onChange={(event) => onTypeChange(event.target.value as AstrologyReportType | "all" | "favorite")}><option value="all">全部</option><option value="favorite">收藏</option>{reportIntents.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="grid gap-3">{reports.map((report) => <button key={report.id} className="history-card" onClick={() => onOpen(report)} type="button"><div><div className="font-semibold">{report.result?.title || report.reportType}</div><div className="mt-1 text-xs text-violet-200/60">{reportLabel(report.reportType)} · {new Date(report.createdAt).toLocaleString()} · {report.status}</div></div><div className="text-right"><div className="text-2xl font-black text-fuchsia-200">{report.score ?? "--"}</div>{report.isFavorite && <div className="text-xs text-fuchsia-200">收藏</div>}</div></button>)}{!reports.length && <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-violet-200/60">暂无符合条件的报告。</div>}</div></section>;
}

function ReportDetailModal({ report, onClose, onCopy, onFavorite, onDelete, onRegenerate }: { report: AstrologyReport; onClose: () => void; onCopy: (report: AstrologyReport) => void; onFavorite: (report: AstrologyReport) => void; onDelete: (id: string) => void; onRegenerate: (report: AstrologyReport) => void }) {
    const result = report.result;
    return <div className="modal-mask"><div className="modal-panel"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-sm text-fuchsia-200/80">{reportLabel(report.reportType)} · {new Date(report.createdAt).toLocaleString()}</div><h2 className="mt-1 text-3xl font-black">{result?.title || "报告详情"}</h2></div><button className="icon-btn" onClick={onClose} type="button"><X size={18} /></button></div>{report.errorMessage && <div className="mb-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-100">{report.errorMessage}</div>}{result && <div className="space-y-5"><p className="leading-7 text-violet-100/80">{result.summary}</p><div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">{Object.entries(result.scores ?? {}).map(([key, value]) => <Metric key={key} label={scoreLabel(key)} value={`${Math.round(value)}%`} />)}</div><div className="flex flex-wrap gap-2">{result.keywords?.map((item) => <span key={item} className="rounded-full bg-fuchsia-300/10 px-3 py-1 text-sm text-fuchsia-100">{item}</span>)}</div>{result.sections?.map((section) => <article key={section.heading} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><h3 className="font-bold text-fuchsia-100">{section.heading}</h3><p className="mt-2 text-sm leading-7 text-violet-100/75">{section.content}</p></article>)}<ListBlock title="行动建议" items={result.actions ?? []} /><ListBlock title="风险提醒" items={result.warnings ?? []} /><div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 p-4 text-sm text-violet-50">{result.closing}</div></div>}<div className="mt-6 flex flex-wrap gap-2"><Action onClick={() => onCopy(report)}><Copy size={14} />复制</Action><Action onClick={() => onFavorite(report)}>{report.isFavorite ? "取消收藏" : "收藏"}</Action><Action onClick={() => onRegenerate(report)}><RefreshCw size={14} />重新生成</Action><Action danger onClick={() => onDelete(report.id)}><Trash2 size={14} />删除</Action></div></div></div>;
}

function Template({ children, onClick }: { children: string; onClick: () => void }) {
    return <button className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-left hover:bg-white/[0.1]" onClick={onClick} type="button"><Wand2 className="mr-1 inline" size={13} />{children}</button>;
}

function Action({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
    return <button className={`action-btn ${danger ? "danger" : ""}`} onClick={onClick} type="button">{children}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="text-xs text-violet-200/60">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
    return <label className="text-sm text-violet-100/80">{label}<input className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none ring-fuchsia-400/40 transition placeholder:text-violet-200/35 focus:ring-2" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Lucky({ label, value }: { label: string; value?: string }) {
    return <div className="rounded-2xl bg-white/[0.05] p-3"><div className="text-violet-200/55">{label}</div><div className="mt-1 font-bold">{value || "--"}</div></div>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null;
    return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h3 className="font-bold text-violet-100">{title}</h3><ul className="mt-3 space-y-2 text-sm text-violet-100/75">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>;
}

function scoreLabel(key: string) {
    return ({ overall: "整体", love: "爱情", career: "事业", wealth: "财富", mood: "情绪", social: "人际" } as Record<string, string>)[key] || key;
}

function reportLabel(type: AstrologyReportType) {
    return reportIntents.find((item) => item.value === type)?.label || type;
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === "object" && error) {
        const directMessage = "message" in error && typeof error.message === "string" ? error.message : null;
        const response = "response" in error && typeof error.response === "object" && error.response ? error.response : null;
        const data = response && "data" in response && typeof response.data === "object" && response.data ? response.data : null;
        const responseMessage = data && "message" in data && typeof data.message === "string" ? data.message : null;
        return responseMessage || directMessage || fallback;
    }
    return fallback;
}

const styles = `
* { box-sizing: border-box; }
body { margin: 0; }
.astro-shell { --astro-bg: #070617; --astro-fg: #fff; --astro-card: rgba(18,13,45,.9); --astro-border: rgba(255,255,255,.1); --astro-muted: rgba(221,214,254,.68); --astro-primary: #a78bfa; --astro-pink: #db2777; --astro-glow: rgba(168,85,247,.34); min-height: 100vh; overflow: hidden; color: var(--astro-fg); background: var(--astro-bg); font-family: Inter, system-ui, sans-serif; }
.astro-bg { position: fixed; inset: 0; background: radial-gradient(circle at 22% 12%, var(--astro-glow), transparent 28%), radial-gradient(circle at 82% 20%, rgba(219,39,119,.18), transparent 24%), linear-gradient(135deg, color-mix(in oklab, var(--astro-primary) 8%, var(--astro-bg)), var(--astro-bg)); pointer-events: none; }
.astro-bg::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(circle, color-mix(in oklab, var(--astro-primary) 42%, transparent) 1px, transparent 1px); background-size: 56px 56px; opacity: .16; }
.astro-page { position: relative; z-index: 1; width: min(1320px, 100%); margin: 0 auto; padding: 24px 18px 38px; }
.astro-topline { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.intent-tabs { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 10px; overflow-x: auto; margin: 16px 0; padding-bottom: 2px; }
.astro-grid { display: grid; grid-template-columns: minmax(0, 1.04fr) minmax(330px, .96fr); gap: 18px; }
.panel { border: 1px solid var(--astro-border); border-radius: 30px; background: color-mix(in oklab, var(--astro-card) 94%, transparent); padding: 22px; box-shadow: 0 28px 70px color-mix(in oklab, var(--astro-primary) 16%, transparent); backdrop-filter: blur(18px); }
.astro-shell input, .astro-shell textarea, .astro-shell select { color-scheme: dark; }
.astro-shell input::placeholder, .astro-shell textarea::placeholder { color: rgba(221,214,254,.38); }
.astro-shell h1, .astro-shell h2, .astro-shell h3, .astro-shell p { margin-top: 0; }
.nav-item { display: flex; align-items: flex-start; gap: 10px; border: 1px solid var(--astro-border); border-radius: 18px; padding: 12px 14px; color: var(--astro-muted); background: color-mix(in oklab, var(--astro-card) 80%, transparent); text-align: left; transition: .2s; }
.nav-item:hover, .nav-item.active { border-color: color-mix(in oklab, var(--astro-primary) 48%, var(--astro-border)); background: color-mix(in oklab, var(--astro-primary) 16%, var(--astro-card)); color: var(--astro-fg); }
.notice-card { border: 1px solid color-mix(in oklab, var(--astro-primary) 26%, var(--astro-border)); border-radius: 18px; background: color-mix(in oklab, var(--astro-primary) 10%, var(--astro-card)); padding: 12px 14px; color: var(--astro-fg); font-size: 14px; }
.primary-btn, .secondary-btn, .favorite-btn { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 12px 18px; color: white; font-weight: 800; background: linear-gradient(135deg, #7c3aed, #db2777); box-shadow: 0 16px 36px rgba(168,85,247,.28); }
.primary-btn:disabled, .secondary-btn:disabled { opacity: .5; cursor: not-allowed; }
.secondary-btn, .favorite-btn { background: color-mix(in oklab, var(--astro-card) 90%, transparent); color: var(--astro-fg); box-shadow: none; border: 1px solid var(--astro-border); }
.profile-card, .history-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; border: 1px solid var(--astro-border); border-radius: 22px; padding: 14px; color: var(--astro-fg); background: color-mix(in oklab, var(--astro-card) 78%, transparent); text-align: left; transition: .2s; }
.profile-card:hover, .profile-card.active, .history-card:hover { border-color: color-mix(in oklab, var(--astro-pink) 42%, var(--astro-border)); transform: translateY(-1px); background: color-mix(in oklab, var(--astro-primary) 12%, var(--astro-card)); }
.mini-action { border-radius: 999px; background: color-mix(in oklab, var(--astro-card) 86%, transparent); padding: 5px 8px; font-size: 12px; color: var(--astro-muted); }
.mini-action.danger { color: #fecdd3; }
.action-btn, .icon-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--astro-border); border-radius: 999px; background: color-mix(in oklab, var(--astro-card) 82%, transparent); color: var(--astro-fg); padding: 8px 12px; font-size: 13px; }
.action-btn.danger { color: #fecdd3; border-color: rgba(244,63,94,.3); }
.icon-btn { width: 36px; height: 36px; justify-content: center; padding: 0; }
.modal-mask { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(5,4,15,.72); backdrop-filter: blur(12px); }
.modal-panel { max-height: 88vh; width: min(920px, 100%); overflow: auto; border: 1px solid var(--astro-border); border-radius: 32px; background: var(--astro-card); padding: 26px; box-shadow: 0 40px 100px rgba(0,0,0,.45); }
@media (max-width: 1120px) { .astro-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .astro-page { padding: 14px 12px 28px; } .astro-topline { display: grid; } .intent-tabs { grid-auto-columns: minmax(124px, 44%); } .panel { border-radius: 24px; padding: 18px; } .modal-mask { padding: 0; align-items: stretch; } .modal-panel { width: 100%; max-height: 100vh; border-radius: 0; } }
`;
