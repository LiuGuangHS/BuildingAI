import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@buildingai/ui/components/ui/alert-dialog";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@buildingai/ui/components/ui/table";
import type { ReactNode } from "react";

import { deleteConsoleTownSave, getConsoleTownSave, getTownStatistics, listConsoleTownSaves } from "../../../services/console/town";
import type { TownSave } from "../../../services/types";

const pageSize = 10;

export default function TownConsolePage() {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);
    const [message, setMessage] = useState("");
    const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
    const searchKeyword = keyword.trim();

    const savesQuery = useQuery({
        queryKey: ["console-town-saves", searchKeyword, page],
        queryFn: () => listConsoleTownSaves({ keyword: searchKeyword || undefined, page, pageSize }),
    });
    const statsQuery = useQuery({
        queryKey: ["console-town-stats"],
        queryFn: getTownStatistics,
    });
    const detailQuery = useQuery<TownSave>({
        queryKey: ["console-town-save", selectedSaveId],
        queryFn: () => getConsoleTownSave(selectedSaveId!),
        enabled: Boolean(selectedSaveId),
    });
    const deleteMutation = useMutation<{ success: boolean }, Error, string>({
        mutationFn: deleteConsoleTownSave,
        onSuccess: () => {
            setMessage("存档已删除");
            void queryClient.invalidateQueries({ queryKey: ["console-town-saves"] });
            void queryClient.invalidateQueries({ queryKey: ["console-town-stats"] });
        },
        onError: (error) => setMessage(error.message || "删除失败，请稍后再试"),
    });

    const total = savesQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const saves = savesQuery.data?.list ?? [];

    function handleSearch() {
        setMessage("");
        setPage(1);
        void queryClient.invalidateQueries({ queryKey: ["console-town-saves"] });
    }

    return (
        <main className="town-console">
            <div className="console-section-header">
                <div>
                    <h1>AI乐园小镇管理</h1>
                    <p className="console-muted">查看存档、资源状态、AI 调用质量和异常诊断。</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        void statsQuery.refetch();
                        void savesQuery.refetch();
                    }}
                >
                    刷新数据
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="存档" value={statsQuery.data?.saveCount} />
                <StatCard label="居民" value={statsQuery.data?.characterCount} />
                <StatCard label="事件" value={statsQuery.data?.eventCount} />
                <StatCard label="活跃存档" value={statsQuery.data?.activeSaveCount} />
                <StatCard label="平均天数" value={statsQuery.data?.averageDay} />
                <StatCard label="平均事件" value={statsQuery.data?.averageEventCount} />
                <StatCard label="居民聊天" value={statsQuery.data?.chatCount} />
                <StatCard label="AI 成功率" value={formatPercent(statsQuery.data?.aiSuccessRate)} />
                <StatCard label="AI 降级率" value={formatPercent(statsQuery.data?.aiFallbackRate)} />
                <StatCard label="今日新增" value={statsQuery.data?.todaySaveCount} />
                <StatCard label="近 7 日行动" value={statsQuery.data?.recentActionCount} />
                <StatCard label="热门行动" value={statsQuery.data?.topActionType} />
                <StatCard label="疑似卡住" value={statsQuery.data?.stuckSaveCount} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <CardTitle>小镇存档</CardTitle>
                            <CardDescription>共 {total} 个存档</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Input
                                value={keyword}
                                placeholder="搜索名称或心情"
                                onChange={(event) => setKeyword(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") handleSearch();
                                }}
                                className="w-56"
                            />
                            <Button onClick={handleSearch}>搜索</Button>
                            <Button variant="outline" onClick={() => savesQuery.refetch()}>
                                刷新
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                    {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
                    {savesQuery.isLoading ? <p className="text-sm text-muted-foreground">正在加载存档...</p> : null}
                    {savesQuery.isError ? <p className="text-sm text-destructive">存档加载失败，请稍后重试。</p> : null}
                    <div className="overflow-hidden rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>名称</TableHead>
                                    <TableHead>等级</TableHead>
                                    <TableHead>今日行动</TableHead>
                                    <TableHead>记忆线索</TableHead>
                                    <TableHead>金币</TableHead>
                                    <TableHead>体力</TableHead>
                                    <TableHead>心情</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {saves.map((save) => {
                                    const actionBudget = getActionBudgetSnapshot(save);
                                    const memorySnapshot = getMemoryPromiseSnapshot(save);
                                    return (
                                    <TableRow key={save.id}>
                                        <TableCell className="font-medium">{save.name}</TableCell>
                                        <TableCell>Lv.{save.level}</TableCell>
                                        <TableCell>{actionBudget.remaining}/{actionBudget.maxPerDay}</TableCell>
                                        <TableCell>{formatMemoryPromiseCell(memorySnapshot)}</TableCell>
                                        <TableCell>{save.coins}</TableCell>
                                        <TableCell>{save.stamina}</TableCell>
                                        <TableCell>{save.mood}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedSaveId(save.id)}>
                                                    详情
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                                                            删除
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>删除存档</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                确认删除存档“{save.name}”？该操作会移除该用户的小镇进度。
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                variant="destructive"
                                                                onClick={() => deleteMutation.mutate(save.id)}
                                                            >
                                                                确认删除
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                                {!savesQuery.isLoading && !saves.length ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-muted-foreground">
                                            暂无匹配存档
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Button
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                        >
                            上一页
                        </Button>
                        <Badge variant="outline">
                            {page} / {totalPages}
                        </Badge>
                        <Button
                            variant="outline"
                            disabled={page >= totalPages}
                            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                        >
                            下一页
                        </Button>
                    </div>
                </CardContent>
            </Card>
            {selectedSaveId ? (
                <Card className="save-detail-panel">
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <CardTitle>存档详情</CardTitle>
                                <CardDescription>查看资源、建筑、任务、居民和最近事件</CardDescription>
                            </div>
                            <Button variant="outline" onClick={() => setSelectedSaveId(null)}>
                                关闭
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {detailQuery.isLoading ? <p className="text-sm text-muted-foreground">正在加载详情...</p> : null}
                        {detailQuery.isError ? <p className="text-sm text-destructive">详情加载失败。</p> : null}
                        {detailQuery.data ? <SaveDetail save={detailQuery.data} /> : null}
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}

function StatCard({ label, value }: { label: string; value: number | string | null | undefined }) {
    return (
        <Card size="sm">
            <CardContent>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="text-2xl font-semibold">{value ?? "-"}</p>
            </CardContent>
        </Card>
    );
}

function SaveDetail({ save }: { save: TownSave }) {
    const worldState = save.worldState;
    const actionBudget = getActionBudgetSnapshot(save);
    return (
        <div className="save-detail-grid">
            <DetailSection title="基础资源">
                <p>Day {save.day} · Lv.{save.level} · 金币 {save.coins} · 体力 {save.stamina} · 心情 {save.mood}</p>
                <p>天气 {worldState.weather} · 声望 {worldState.reputation} · Focus {worldState.focus}</p>
                <p>今日行动：{actionBudget.remaining}/{actionBudget.maxPerDay} · 已用 {actionBudget.used} · 最近动作 {actionBudget.usedActions.length ? actionBudget.usedActions.join("、") : "无"}</p>
                <p>连续开张：{formatRetentionSnapshot(save)}</p>
                <p>记忆线索：{formatMemoryPromiseSnapshot(save)}</p>
                <p>区域：{worldState.unlockedAreas.join("、")}</p>
                <p>诊断：{getDiagnosticText(save)}</p>
            </DetailSection>
            <DetailSection title="建筑">
                {worldState.buildings.map((building) => <p key={building.id}>{building.name} Lv.{building.level} · {building.status} · {building.effect}</p>)}
            </DetailSection>
            <DetailSection title="任务">
                {(worldState.dailyTasks ?? []).map((task) => <p key={task.id}>{task.completed ? "[完成]" : "[进行]"} {task.title} {task.progress}/{task.target}</p>)}
                {worldState.weeklyGoal ? <p>周目标：{worldState.weeklyGoal.title} {worldState.weeklyGoal.progress}/{worldState.weeklyGoal.target}</p> : null}
                {worldState.mainQuest ? <p>主线：第 {worldState.mainQuest.chapter} 章 {worldState.mainQuest.title}</p> : null}
            </DetailSection>
            <DetailSection title="居民">
                {save.characters.map((character) => (
                    <p key={character.id}>
                        {character.name} · {character.role} · 关系 {character.relationship} · {character.status}
                        {character.memory?.mood ? ` · 心情 ${character.memory.mood}` : ""}
                        {character.memory?.summary ? ` · ${character.memory.summary}` : ""}
                        {character.memory?.keyMoments?.length ? ` · 关键时刻 ${character.memory.keyMoments.length}` : ""}
                        {character.memory?.promises?.length ? ` · 约定 ${character.memory.promises.length}` : ""}
                    </p>
                ))}
            </DetailSection>
            <DetailSection className="detail-wide" title="最近事件">
                {save.events.slice(0, 8).map((event) => <p key={event.id}><strong>{event.title}</strong>：{event.content}</p>)}
            </DetailSection>
            <DetailSection className="detail-wide" title="成就">
                <p>{worldState.achievements?.length ? worldState.achievements.join("、") : "暂无成就"}</p>
            </DetailSection>
        </div>
    );
}

function DetailSection({ children, className, title }: { children: ReactNode; className?: string; title: string }) {
    return (
        <Card size="sm" className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {children}
            </CardContent>
        </Card>
    );
}

function getDiagnosticText(save: TownSave) {
    const issues: string[] = [];
    const actionBudget = getActionBudgetSnapshot(save);
    if (save.stamina < 20) issues.push("体力偏低");
    if (save.coins < 40) issues.push("金币紧张");
    if (actionBudget.remaining <= 0) issues.push("今日行动已用完");
    if (save.worldState.retention && !save.worldState.retention.todayQualified && actionBudget.used > 0) issues.push("今日有效日程未闭合");
    if (getMemoryPromiseSnapshot(save).count >= 3) issues.push("待回应约定较多");
    if (save.day > 7 && save.events.length < 5) issues.push("事件偏少");
    if ((save.worldState.dailyTasks ?? []).some((task) => !task.completed) && save.day > 3) issues.push("今日任务未清完");
    if (!issues.length) return "状态正常";
    return `${issues.join("、")}，建议优先推进经营和关系事件`;
}

type MemoryPromiseSource = Pick<TownSave, "characters"> | { characters?: TownSave["characters"] };

function getMemoryPromiseSnapshot(save: MemoryPromiseSource) {
    if (!Array.isArray(save.characters)) {
        return { available: false, count: 0, names: "" };
    }
    const characters = save.characters;
    const entries = characters
        .map((character) => ({ name: character.name, count: character.memory?.promises?.length ?? 0 }))
        .filter((item) => item.count > 0);
    return {
        available: true,
        count: entries.reduce((total, item) => total + item.count, 0),
        names: entries.map((item) => `${item.name} ${item.count}`).join("、"),
    };
}

function formatMemoryPromiseSnapshot(save: TownSave) {
    const snapshot = getMemoryPromiseSnapshot(save);
    return snapshot.count ? `${snapshot.count} 条待回应 · ${snapshot.names}` : "无待回应约定";
}

function formatMemoryPromiseCell(snapshot: ReturnType<typeof getMemoryPromiseSnapshot>) {
    if (!snapshot.available) return "详情可见";
    return snapshot.count ? `${snapshot.count} 条 · ${snapshot.names}` : "无";
}

function formatRetentionSnapshot(save: TownSave) {
    const retention = save.worldState.retention;
    if (!retention) return "未记录";
    return `${retention.streak ? `${retention.streak} 天` : "未开始"} · ${retention.todayQualified ? "今日已形成有效日程" : "今日未形成有效日程"} · 下次 ${retention.nextHook.title}`;
}

function getActionBudgetSnapshot(save: TownSave) {
    const raw = save.worldState.flags?.actionBudget;
    const source = raw && typeof raw === "object" ? raw as { day?: unknown; maxPerDay?: unknown; usedActions?: unknown } : {};
    const maxPerDay = typeof source.maxPerDay === "number" && source.maxPerDay > 0 ? source.maxPerDay : 4;
    const usedActions = source.day === save.day && Array.isArray(source.usedActions)
        ? [...new Set(source.usedActions.filter((item): item is string => typeof item === "string"))]
        : [];
    const used = Math.min(maxPerDay, usedActions.length);
    return {
        maxPerDay,
        used,
        remaining: Math.max(0, maxPerDay - used),
        usedActions,
    };
}

function formatPercent(value: number | undefined) {
    return typeof value === "number" ? `${value}%` : undefined;
}
