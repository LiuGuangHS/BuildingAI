import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
            <h1>AI乐园小镇管理</h1>
            <div className="console-stats">
                <div><span>存档</span><strong>{statsQuery.data?.saveCount ?? "-"}</strong></div>
                <div><span>居民</span><strong>{statsQuery.data?.characterCount ?? "-"}</strong></div>
                <div><span>事件</span><strong>{statsQuery.data?.eventCount ?? "-"}</strong></div>
                <div><span>活跃存档</span><strong>{statsQuery.data?.activeSaveCount ?? "-"}</strong></div>
                <div><span>平均天数</span><strong>{statsQuery.data?.averageDay ?? "-"}</strong></div>
                <div><span>平均事件</span><strong>{statsQuery.data?.averageEventCount ?? "-"}</strong></div>
                <div><span>NPC 聊天</span><strong>{statsQuery.data?.chatCount ?? "-"}</strong></div>
                <div><span>AI 成功率</span><strong>{statsQuery.data?.aiSuccessRate ?? "-"}%</strong></div>
                <div><span>AI 降级率</span><strong>{statsQuery.data?.aiFallbackRate ?? "-"}%</strong></div>
                <div><span>今日新增</span><strong>{statsQuery.data?.todaySaveCount ?? "-"}</strong></div>
                <div><span>近 7 日行动</span><strong>{statsQuery.data?.recentActionCount ?? "-"}</strong></div>
                <div><span>热门行动</span><strong>{statsQuery.data?.topActionType ?? "-"}</strong></div>
                <div><span>疑似卡住</span><strong>{statsQuery.data?.stuckSaveCount ?? "-"}</strong></div>
            </div>
            <section className="console-table">
                <div className="console-section-header">
                    <div>
                        <h2>小镇存档</h2>
                        <p className="console-muted">共 {total} 个存档</p>
                    </div>
                    <div className="console-actions">
                        <input
                            value={keyword}
                            placeholder="搜索名称或心情"
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") handleSearch();
                            }}
                        />
                        <button className="console-primary" onClick={handleSearch}>搜索</button>
                        <button className="console-secondary" onClick={() => savesQuery.refetch()}>刷新</button>
                    </div>
                </div>
                {message ? <p className="console-message">{message}</p> : null}
                {savesQuery.isLoading ? <p className="console-muted">正在加载存档...</p> : null}
                {savesQuery.isError ? <p className="console-message error">存档加载失败，请稍后重试。</p> : null}
                <table>
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>等级</th>
                            <th>金币</th>
                            <th>体力</th>
                            <th>心情</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {saves.map((save) => (
                            <tr key={save.id}>
                                <td>{save.name}</td>
                                <td>Lv.{save.level}</td>
                                <td>{save.coins}</td>
                                <td>{save.stamina}</td>
                                <td>{save.mood}</td>
                                <td>
                                    <button className="console-secondary" onClick={() => setSelectedSaveId(save.id)}>详情</button>
                                    <button className="console-danger" disabled={deleteMutation.isPending} onClick={() => {
                                        if (window.confirm(`确认删除存档“${save.name}”？`)) deleteMutation.mutate(save.id);
                                    }}>
                                        删除
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!savesQuery.isLoading && !saves.length ? (
                            <tr>
                                <td colSpan={6}>暂无匹配存档</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
                <div className="console-pagination">
                    <button className="console-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
                    <span>{page} / {totalPages}</span>
                    <button className="console-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
                </div>
            </section>
            {selectedSaveId ? (
                <section className="console-table save-detail-panel">
                    <div className="console-section-header">
                        <div>
                            <h2>存档详情</h2>
                            <p className="console-muted">查看资源、建筑、任务、居民和最近事件</p>
                        </div>
                        <button className="console-secondary" onClick={() => setSelectedSaveId(null)}>关闭</button>
                    </div>
                    {detailQuery.isLoading ? <p className="console-muted">正在加载详情...</p> : null}
                    {detailQuery.isError ? <p className="console-message error">详情加载失败。</p> : null}
                    {detailQuery.data ? <SaveDetail save={detailQuery.data} /> : null}
                </section>
            ) : null}
        </main>
    );
}

function SaveDetail({ save }: { save: TownSave }) {
    const worldState = save.worldState;
    return (
        <div className="save-detail-grid">
            <section>
                <h3>基础资源</h3>
                <p>Day {save.day} · Lv.{save.level} · 金币 {save.coins} · 体力 {save.stamina} · 心情 {save.mood}</p>
                <p>天气 {worldState.weather} · 声望 {worldState.reputation} · Focus {worldState.focus}</p>
                <p>区域：{worldState.unlockedAreas.join("、")}</p>
                <p>诊断：{getDiagnosticText(save)}</p>
            </section>
            <section>
                <h3>建筑</h3>
                {worldState.buildings.map((building) => <p key={building.id}>{building.name} Lv.{building.level} · {building.status} · {building.effect}</p>)}
            </section>
            <section>
                <h3>任务</h3>
                {(worldState.dailyTasks ?? []).map((task) => <p key={task.id}>{task.completed ? "[完成]" : "[进行]"} {task.title} {task.progress}/{task.target}</p>)}
                {worldState.weeklyGoal ? <p>周目标：{worldState.weeklyGoal.title} {worldState.weeklyGoal.progress}/{worldState.weeklyGoal.target}</p> : null}
                {worldState.mainQuest ? <p>主线：第 {worldState.mainQuest.chapter} 章 {worldState.mainQuest.title}</p> : null}
            </section>
            <section>
                <h3>居民</h3>
                {save.characters.map((character) => <p key={character.id}>{character.name} · {character.role} · 关系 {character.relationship} · {character.status}</p>)}
            </section>
            <section className="detail-wide">
                <h3>最近事件</h3>
                {save.events.slice(0, 8).map((event) => <p key={event.id}><strong>{event.title}</strong>：{event.content}</p>)}
            </section>
            <section className="detail-wide">
                <h3>成就</h3>
                <p>{worldState.achievements?.length ? worldState.achievements.join("、") : "暂无成就"}</p>
            </section>
        </div>
    );
}

function getDiagnosticText(save: TownSave) {
    const issues: string[] = [];
    if (save.stamina < 20) issues.push("体力偏低");
    if (save.coins < 40) issues.push("金币紧张");
    if (save.day > 7 && save.events.length < 5) issues.push("事件偏少");
    if ((save.worldState.dailyTasks ?? []).some((task) => !task.completed) && save.day > 3) issues.push("今日任务未清完");
    if (!issues.length) return "状态正常";
    return `${issues.join("、")}，建议优先推进经营和关系事件`;
}
